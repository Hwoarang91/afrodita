'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Loader2, Smartphone, QrCode, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface TelegramAuthTabProps {
  onAuthSuccess?: () => void;
}

export default function TelegramAuthTab({ onAuthSuccess }: TelegramAuthTabProps) {
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
  const [twoFAPassword, setTwoFAPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);

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

  const isConnected = sessionsData?.sessions?.length > 0;

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
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка генерации QR-кода');
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
    if (authMethod === 'qr' && qrTokenId && qrStatus === 'pending') {
      // Обновляем таймер каждую секунду
      const timerInterval = setInterval(() => {
        if (qrExpiresAt > 0) {
          // qrExpiresAt приходит в секундах (Unix timestamp)
          // Проверяем, не в миллисекундах ли оно (если больше 1e10, значит миллисекунды)
          const expiresAtSeconds = qrExpiresAt > 1e10 ? Math.floor(qrExpiresAt / 1000) : qrExpiresAt;
          const remaining = Math.max(0, expiresAtSeconds - Math.floor(Date.now() / 1000));
          setQrTimeRemaining(remaining);
          if (remaining === 0 && qrStatus === 'pending') {
            setQrStatus('expired');
            toast.error('QR-код истек. Генерируем новый...');
            generateQrCode();
          }
        }
      }, 1000);
      
      // Проверяем статус каждые 2 секунды
      const interval = setInterval(async () => {
        try {
          const response = await apiClient.get(`/auth/telegram/qr/status/${qrTokenId}`);
          const status = response.data.status;
          setQrStatus(status);
          
          // Обновляем информацию о времени до истечения
          if (response.data.timeRemaining !== undefined) {
            setQrTimeRemaining(response.data.timeRemaining);
          }
          if (response.data.expiresAt) {
            setQrExpiresAt(response.data.expiresAt);
          }

          if (status === 'accepted' && response.data.user) {
            toast.success('Telegram аккаунт успешно подключен!');
            refetchSessions();
            // Сброс формы
            setQrTokenId('');
            setQrUrl('');
            setQrStatus('pending');
            setQrTimeRemaining(0);
            // Вызываем callback для переключения на таб личных сообщений
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          } else if (status === 'expired') {
            toast.error('QR-код истек. Генерируем новый...');
            setQrTokenId('');
            setQrUrl('');
            setQrStatus('pending');
            setQrTimeRemaining(0);
            generateQrCode();
          }
        } catch (error: any) {
          console.error('Error checking QR status:', error);
        }
      }, 2000);

      return () => {
        clearInterval(interval);
        clearInterval(timerInterval);
      };
    }
  }, [authMethod, qrTokenId, qrStatus, qrExpiresAt, generateQrCode, refetchSessions]);

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
      toast.success('Код отправлен на ваш телефон');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка отправки кода');
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
        // Сброс формы
        setPhoneNumber('');
        setCode('');
        setPhoneCodeHash('');
        setRequires2FA(false);
        // Вызываем callback для переключения на таб личных сообщений
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка проверки кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFAPassword || !phoneCodeHash) {
      toast.error('Введите пароль 2FA');
      return;
    }

    if (!phoneNumber) {
      toast.error('Номер телефона не указан');
      return;
    }

    try {
      setIsLoading(true);
      // Убеждаемся, что пароль передается как строка
      const passwordToSend = String(twoFAPassword).trim();
      if (!passwordToSend) {
        toast.error('Пароль не может быть пустым');
        setIsLoading(false);
        return;
      }

      const response = await apiClient.post('/auth/telegram/2fa/verify', {
        phoneNumber: phoneNumber.trim(),
        password: passwordToSend,
        phoneCodeHash,
      });

      if (response.data.success) {
        toast.success('Telegram аккаунт успешно подключен!');
        refetchSessions();
        // Сброс формы
        setPhoneNumber('');
        setCode('');
        setPhoneCodeHash('');
        setTwoFAPassword('');
        setRequires2FA(false);
        // Вызываем callback для переключения на таб личных сообщений
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка проверки 2FA пароля');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Статус подключения */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Статус подключения</CardTitle>
            <Badge variant={isConnected ? 'default' : 'destructive'} className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Подключено
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Не подключено
                </>
              )}
            </Badge>
          </div>
          <CardDescription>
            {isConnected
              ? 'Ваш Telegram аккаунт подключен. Вы можете отправлять сообщения от своего имени.'
              : 'Подключите свой Telegram аккаунт для отправки сообщений клиентам от вашего имени.'}
          </CardDescription>
        </CardHeader>
        {isConnected && sessionsData?.sessions?.[0] && (
          <CardContent>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Телефон:</span>{' '}
                {sessionsData.sessions[0].phoneNumber || 'Не указан'}
              </div>
              <div>
                <span className="text-muted-foreground">Активных сессий:</span> {sessionsData.sessions.length}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Форма авторизации */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Подключение Telegram</CardTitle>
            <CardDescription>
              Выберите способ авторизации: через номер телефона или QR-код
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

              <TabsContent value="phone" className="space-y-4 mt-4">
                {!requires2FA ? (
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
                        disabled={isRequestingCode}
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
                          />
                        </div>
                        <Button
                          onClick={handleVerifyCode}
                          disabled={isLoading}
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
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleVerify2FA();
                    }}
                    className="space-y-4"
                  >
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Shield className="w-5 h-5" />
                      <p className="text-sm">Требуется двухфакторная аутентификация</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="2fa-password">Пароль 2FA</Label>
                      {passwordHint && (
                        <p className="text-xs text-muted-foreground mb-1">
                          Подсказка: {passwordHint}
                        </p>
                      )}
                      <PasswordInput
                        id="2fa-password"
                        name="2fa-password"
                        value={twoFAPassword}
                        onChange={(e) => setTwoFAPassword(e.target.value)}
                        placeholder="Введите пароль 2FA"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading || !twoFAPassword}
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Проверка...
                        </>
                      ) : (
                        'Подтвердить'
                      )}
                    </Button>
                  </form>
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
                    <div className="p-4 bg-white rounded-lg">
                      {qrUrl && <QRCodeSVG value={qrUrl} size={256} />}
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium">Отсканируйте QR-код в приложении Telegram</p>
                      {qrStatus === 'pending' && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Ожидание сканирования...
                          </p>
                          {qrTimeRemaining > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Осталось времени: {Math.floor(qrTimeRemaining / 60)}:{(Math.floor(qrTimeRemaining % 60)).toString().padStart(2, '0')}
                            </p>
                          )}
                        </>
                      )}
                      {qrStatus === 'accepted' && (
                        <p className="text-xs text-green-600">QR-код принят!</p>
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
                  <Button onClick={generateQrCode} className="w-full">
                    Сгенерировать QR-код
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

