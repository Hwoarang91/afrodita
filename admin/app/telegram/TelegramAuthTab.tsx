'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Loader2, Smartphone, QrCode } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Telegram2FATab } from './components/Telegram2FATab';
import { AuthStepper, type AuthStep, type StepStatus } from './components/AuthStepper';
import { CountdownTimer } from './components/CountdownTimer';

interface TelegramAuthTabProps {
  onAuthSuccess?: () => void;
}

export default function TelegramAuthTab({ onAuthSuccess }: TelegramAuthTabProps) {
  const queryClient = useQueryClient(); // КРИТИЧНО: Для инвалидации кеша статуса сессии
  const [authMethod, setAuthMethod] = useState<'phone' | 'qr'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [qrTokenId, setQrTokenId] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState<number>(0);
  const [qrTimeRemaining, setQrTimeRemaining] = useState<number>(0);
  const [qrStatus, setQrStatus] = useState<'pending' | 'accepted' | 'expired'>('pending');
  const [passwordHint, setPasswordHint] = useState<string>('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null); // Время истечения кода (timestamp в секундах)

  // Проверка статуса авторизации
  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['telegram-user-sessions'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/telegram/user/sessions');
        return response.data;
      } catch (error) {
        return { sessions: [] };
      }
    },
    retry: false,
  });

  // КРИТИЧНО: Используем currentSessionId из backend, а не первую попавшуюся активную сессию
  // Это гарантирует, что UI показывает правильную сессию при наличии нескольких активных
  const currentSessionId = sessionsData?.currentSessionId;
  const activeSession = currentSessionId
    ? sessionsData?.sessions?.find((s: any) => s.id === currentSessionId && s.status === 'active')
    : sessionsData?.sessions?.find((s: any) => s.status === 'active'); // Fallback для обратной совместимости
  const isConnected = Boolean(activeSession);

  const generateQrCode = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.post('/auth/telegram/qr/generate');
      setQrTokenId(response.data.tokenId);
      setQrUrl(response.data.qrUrl);
      setQrExpiresAt(response.data.expiresAt);
      setQrTimeRemaining(response.data.expiresAt ? Math.max(0, response.data.expiresAt - Math.floor(Date.now() / 1000)) : 0);
      setQrStatus('pending');
      toast.success('QR-код сгенерирован');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Ошибка генерации QR-кода');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Генерация QR-кода при выборе метода QR
  useEffect(() => {
    if (authMethod === 'qr' && !qrTokenId) {
      generateQrCode();
    }
  }, [authMethod, qrTokenId, generateQrCode]);

  // Polling статуса QR-кода и обновление таймера
  useEffect(() => {
    if (authMethod !== 'qr' || !qrTokenId || qrStatus !== 'pending') return;

    // Только обновляем отображаемый таймер каждую секунду. Истечение обрабатывает poll (API возвращает status 'expired').
    const timerInterval = setInterval(() => {
      if (qrExpiresAt <= 0) return;
      const expiresAtSeconds = qrExpiresAt > 1e10 ? Math.floor(qrExpiresAt / 1000) : qrExpiresAt;
      const remaining = Math.max(0, expiresAtSeconds - Math.floor(Date.now() / 1000));
      setQrTimeRemaining(remaining);
    }, 1000);

    let retryCount = 0;
    const maxRetries = 30;
    const pollInterval = 2000;

    const interval = setInterval(async () => {
      const stopPolling = () => {
        clearInterval(interval);
        clearInterval(timerInterval);
      };
      try {
        const response = await apiClient.get(`/auth/telegram/qr/status/${qrTokenId}`);
        const status = response.data.status;
        setQrStatus(status);

        if (response.data.timeRemaining !== undefined) {
          setQrTimeRemaining(response.data.timeRemaining);
        }
        if (response.data.expiresAt) {
          setQrExpiresAt(response.data.expiresAt);
        }

        if (status === 'accepted' && response.data.user) {
          stopPolling();
          toast.success('Telegram аккаунт успешно подключен!');
          refetchSessions();
          queryClient.invalidateQueries({ queryKey: ['telegram-session-status'] });
          setQrTokenId('');
          setQrUrl('');
          setQrStatus('pending');
          setQrTimeRemaining(0);
          if (onAuthSuccess) onAuthSuccess();
          return;
        }

        if (status === 'expired') {
          stopPolling();
          toast.error('QR-код истек. Генерируем новый...');
          setQrTokenId('');
          setQrUrl('');
          setQrStatus('pending');
          setQrTimeRemaining(0);
          generateQrCode();
          return;
        }

        retryCount++;
        if (retryCount >= maxRetries) {
          stopPolling();
          toast.error('Превышено время ожидания. Генерируем новый QR-код...');
          setQrTokenId('');
          setQrUrl('');
          setQrStatus('pending');
          setQrTimeRemaining(0);
          generateQrCode();
        }
      } catch (err: unknown) {
        const ax = (err as { response?: { status?: number } })?.response;
        if (ax?.status === 401 || ax?.status === 403) {
          stopPolling();
          toast.error('Ошибка авторизации. Пожалуйста, попробуйте снова.');
          setQrTokenId('');
          setQrUrl('');
          setQrStatus('pending');
          setQrTimeRemaining(0);
          return;
        }
        retryCount++;
        if (retryCount >= maxRetries) {
          stopPolling();
          toast.error('Превышено время ожидания. Генерируем новый QR-код...');
          setQrTokenId('');
          setQrUrl('');
          setQrStatus('pending');
          setQrTimeRemaining(0);
          generateQrCode();
        }
      }
    }, pollInterval);

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, [authMethod, qrTokenId, qrStatus, qrExpiresAt, generateQrCode, refetchSessions, onAuthSuccess, queryClient]);

  const handleRequestCode = async () => {
    if (!phoneNumber) {
      toast.error('Введите номер телефона');
      return;
    }

    try {
      setIsRequestingCode(true);
      const response = await apiClient.post('/auth/telegram/phone/request', {
        phoneNumber,
      });
      setPhoneCodeHash(response.data.phoneCodeHash);
      // Код Telegram живет 60 секунд по умолчанию (можно расширить, если backend будет возвращать timeout)
      setCodeExpiresAt(Math.floor(Date.now() / 1000) + 60);
      toast.success('Код отправлен на ваш телефон');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Ошибка отправки кода');
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || !phoneCodeHash) {
      toast.error('Введите код подтверждения');
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.post('/auth/telegram/phone/verify', {
        phoneNumber,
        code,
        phoneCodeHash,
      });

      if (response.data.requires2FA) {
        setRequires2FA(true);
        setPasswordHint(response.data.passwordHint || '');
        toast.info('Требуется двухфакторная аутентификация' + (response.data.passwordHint ? ` (Подсказка: ${response.data.passwordHint})` : ''));
      } else {
        toast.success('Telegram аккаунт успешно подключен!');
        refetchSessions();
        // КРИТИЧНО: Инвалидируем кеш статуса сессии для немедленного обновления UI
        queryClient.invalidateQueries({ queryKey: ['telegram-session-status'] });
        // Сброс формы
        setPhoneNumber('');
        setCode('');
        setPhoneCodeHash('');
        setCodeExpiresAt(null);
        setRequires2FA(false);
        // Вызываем callback для переключения на таб личных сообщений
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      }
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: unknown; errorCode?: string } } })?.response?.data;
      const errorMessage = (typeof data?.message === 'string' ? data.message : null) || 'Ошибка проверки кода';
      const errorCode = data?.errorCode;
      toast.error(errorMessage);

      if (errorCode === 'PHONE_CODE_EXPIRED' || /истек|expired/i.test(errorMessage)) {
        setPhoneCodeHash('');
        setCode('');
        setCodeExpiresAt(null);
        toast.info('Код истек. Пожалуйста, запросите новый код.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Форма авторизации */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Подключение Telegram</CardTitle>
            <CardDescription>
              Подключите свой Telegram аккаунт для отправки сообщений клиентам от вашего имени
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMethod} onValueChange={(value) => setAuthMethod(value as 'phone' | 'qr')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="phone">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Телефон
                </TabsTrigger>
                <TabsTrigger value="qr">
                  <QrCode className="w-4 h-4 mr-2" />
                  QR-код
                </TabsTrigger>
              </TabsList>

              <TabsContent value="phone" className="space-y-6 mt-4">
                {/* Stepper для визуализации процесса авторизации */}
                {(() => {
                  const steps: AuthStep[] = [
                    {
                      id: 'phone',
                      label: 'Телефон',
                      status: phoneCodeHash
                        ? ('completed' as StepStatus)
                        : phoneNumber.trim() && !phoneCodeHash
                        ? ('active' as StepStatus)
                        : ('pending' as StepStatus),
                    },
                    {
                      id: 'code',
                      label: 'Код',
                      status: requires2FA
                        ? ('completed' as StepStatus)
                        : phoneCodeHash && !requires2FA
                        ? isLoading
                          ? ('active' as StepStatus)
                          : ('active' as StepStatus)
                        : ('pending' as StepStatus),
                    },
                    {
                      id: '2fa',
                      label: '2FA',
                      status: requires2FA
                        ? isLoading
                          ? ('active' as StepStatus)
                          : ('active' as StepStatus)
                        : phoneCodeHash && !requires2FA
                        ? ('pending' as StepStatus)
                        : ('pending' as StepStatus),
                    },
                  ];

                  const currentStepIndex = steps.findIndex((s) => s.status === 'active');

                  return <AuthStepper steps={steps} currentStepIndex={currentStepIndex >= 0 ? currentStepIndex : undefined} />;
                })()}

                {requires2FA ? (
                  <Telegram2FATab
                    phoneNumber={phoneNumber}
                    phoneCodeHash={phoneCodeHash}
                    passwordHint={passwordHint}
                    onSuccess={() => {
                      refetchSessions();
                      queryClient.invalidateQueries({ queryKey: ['telegram-session-status'] });
                      setPhoneNumber('');
                      setCode('');
                      setPhoneCodeHash('');
                      setRequires2FA(false);
                      if (onAuthSuccess) {
                        onAuthSuccess();
                      }
                    }}
                    onCancel={() => {
                      setRequires2FA(false);
                    }}
                    onRestart={() => {
                      setPhoneNumber('');
                      setCode('');
                      setPhoneCodeHash('');
                      setCodeExpiresAt(null);
                      setRequires2FA(false);
                    }}
                  />
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Номер телефона</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+79991234567"
                        disabled={!!phoneCodeHash}
                      />
                    </div>

                    {!phoneCodeHash ? (
                      <Button
                        onClick={handleRequestCode}
                        disabled={isRequestingCode || !phoneNumber.trim()}
                        className="w-full"
                      >
                        {isRequestingCode ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Отправка...
                          </>
                        ) : (
                          'Отправить код'
                        )}
                      </Button>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="code">Код подтверждения</Label>
                          <Input
                            id="code"
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="12345"
                            maxLength={6}
                            autoFocus
                          />
                          {codeExpiresAt !== null && codeExpiresAt > Math.floor(Date.now() / 1000) && (
                            <CountdownTimer
                              initialSeconds={Math.max(0, codeExpiresAt - Math.floor(Date.now() / 1000))}
                              onExpire={() => {
                                setCodeExpiresAt(null);
                                setPhoneCodeHash('');
                                setCode('');
                              }}
                              onReset={() => {
                                // Запрашиваем новый код при истечении времени
                                handleRequestCode();
                              }}
                              variant="compact"
                              className="mt-2"
                            />
                          )}
                        </div>
                        <Button
                          onClick={handleVerifyCode}
                          disabled={isLoading || !code.trim()}
                          className="w-full"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Проверка...
                            </>
                          ) : (
                            'Войти'
                          )}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="qr" className="space-y-4 mt-4">
                {isLoading && !qrTokenId ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">Генерация QR-кода...</p>
                  </div>
                ) : qrTokenId ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-border">
                      {qrUrl && <QRCodeSVG value={qrUrl} size={256} />}
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium text-foreground">Отсканируйте QR-код в приложении Telegram</p>
                      {qrStatus === 'pending' && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Ожидание сканирования...
                          </p>
                          {qrTimeRemaining > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Осталось времени: {Math.floor(qrTimeRemaining / 60)}:{(qrTimeRemaining % 60).toString().padStart(2, '0')}
                            </p>
                          )}
                        </>
                      )}
                      {qrStatus === 'accepted' && (
                        <p className="text-xs text-green-600 dark:text-green-400">QR-код принят!</p>
                      )}
                      {qrStatus === 'expired' && (
                        <p className="text-xs text-destructive">QR-код истек</p>
                      )}
                    </div>
                    {qrStatus === 'expired' && (
                      <Button onClick={generateQrCode} variant="outline" className="w-full">
                        Обновить QR-код
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button onClick={generateQrCode} className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Генерация...
                      </>
                    ) : (
                      'Сгенерировать QR-код'
                    )}
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

