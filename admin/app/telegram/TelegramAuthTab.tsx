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
import { useAuth } from '@/lib/contexts/AuthContext';
import { Telegram2FATab } from './components/Telegram2FATab';

interface TelegramAuthTabProps {
  onAuthSuccess?: () => void;
}

export default function TelegramAuthTab({ onAuthSuccess }: TelegramAuthTabProps) {
  const { user } = useAuth(); // Получаем данные текущего пользователя (админа)
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
      
      // Проверяем статус с max retries и обработкой ошибок
      let retryCount = 0;
      const maxRetries = 30; // Максимум 30 попыток (около 60 секунд при интервале 2 сек)
      const pollInterval = 2000; // Интервал 2 секунды
      
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
            clearInterval(interval);
            toast.success('Telegram аккаунт успешно подключен!');
            refetchSessions();
            // КРИТИЧНО: Инвалидируем кеш статуса сессии для немедленного обновления UI
            queryClient.invalidateQueries({ queryKey: ['telegram-session-status'] });
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
            clearInterval(interval);
            toast.error('QR-код истек. Генерируем новый...');
            setQrTokenId('');
            setQrUrl('');
            setQrStatus('pending');
            setQrTimeRemaining(0);
            generateQrCode();
          } else {
            // Увеличиваем счетчик попыток
            retryCount++;
            if (retryCount >= maxRetries) {
              clearInterval(interval);
              toast.error('Превышено время ожидания. Генерируем новый QR-код...');
              setQrTokenId('');
              setQrUrl('');
              setQrStatus('pending');
              setQrTimeRemaining(0);
              generateQrCode();
            }
          }
        } catch (error: any) {
          console.error('Error checking QR status:', error);
          
          // Останавливаем polling при критических ошибках
          if (error.response?.status === 401 || error.response?.status === 403) {
            clearInterval(interval);
            toast.error('Ошибка авторизации. Пожалуйста, попробуйте снова.');
            setQrTokenId('');
            setQrUrl('');
            setQrStatus('pending');
            setQrTimeRemaining(0);
            return;
          }
          
          // Увеличиваем счетчик попыток при ошибках
          retryCount++;
          if (retryCount >= maxRetries) {
            clearInterval(interval);
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
        // КРИТИЧНО: Инвалидируем кеш статуса сессии для немедленного обновления UI
        queryClient.invalidateQueries({ queryKey: ['telegram-session-status'] });
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
      const errorMessage = error.response?.data?.message || 'Ошибка проверки кода';
      toast.error(errorMessage);
      
      // Автоматический сброс при PHONE_CODE_EXPIRED
      if (errorMessage.includes('PHONE_CODE_EXPIRED') || errorMessage.includes('expired') || errorMessage.includes('истек')) {
        setPhoneCodeHash('');
        setCode('');
        toast.info('Код истек. Пожалуйста, запросите новый код.');
      }
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

      // КРИТИЧНО: Создаем СТРОГО типизированный payload БЕЗ userId
      // Используем JSON.parse(JSON.stringify()) для полной изоляции от прототипов
      const cleanPayload = {
        phoneNumber: phoneNumber.trim(),
        password: passwordToSend,
        phoneCodeHash,
      };
      
      // Дополнительная защита: создаем новый объект через JSON для гарантии чистоты
      const requestBody = JSON.parse(JSON.stringify(cleanPayload)) as {
        phoneNumber: string;
        password: string;
        phoneCodeHash: string;
      };
      
      // Финальная проверка - убеждаемся что userId отсутствует
      if ('userId' in requestBody || (requestBody as any).userId !== undefined) {
        delete (requestBody as any).userId;
        if (process.env.NODE_ENV === 'development') {
          console.error('[2FA] ⚠️ userId was detected and removed from requestBody');
        }
      }
      
      // Логируем для отладки (только в dev режиме)
      if (process.env.NODE_ENV === 'development') {
        console.log('[2FA] ✅ Clean request body keys:', Object.keys(requestBody));
        console.log('[2FA] ✅ userId in body?', 'userId' in requestBody);
        console.log('[2FA] ✅ Full body:', JSON.stringify(requestBody));
      }
      
      const response = await apiClient.post('/auth/telegram/2fa/verify', requestBody);

      if (response.data.success) {
        toast.success('Telegram аккаунт успешно подключен!');
        refetchSessions();
        // КРИТИЧНО: Инвалидируем кеш статуса сессии для немедленного обновления UI
        queryClient.invalidateQueries({ queryKey: ['telegram-session-status'] });
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
      // КРИТИЧНО: Нормализация ошибок для работы с единым ErrorResponse контрактом
      // Backend теперь всегда возвращает стандартизированный формат:
      // { success: false, statusCode, errorCode, message: string, details?: ErrorDetail[] }
      // Это гарантирует, что message всегда строка, а не объект или массив
      const extractErrorMessage = (err: any): string => {
        const data = err?.response?.data;

        if (!data) {
          return 'Неизвестная ошибка';
        }

        // КРИТИЧНО: Аварийный safeguard - если message не строка, логируем и возвращаем безопасное сообщение
        if (data.message && typeof data.message !== 'string') {
          console.error('[ErrorContractViolation] message is not a string:', {
            type: typeof data.message,
            isArray: Array.isArray(data.message),
            value: data.message,
            fullData: data,
          });
          // Возвращаем безопасное сообщение вместо объекта
          return 'Произошла ошибка валидации. Проверьте введенные данные.';
        }

        // Новый стандартизированный формат ErrorResponse
        if (data.message && typeof data.message === 'string') {
          // Если есть details, добавляем их к сообщению
          if (Array.isArray(data.details) && data.details.length > 0) {
            const detailsMessages = data.details
              .map((detail: any) => {
                if (typeof detail === 'string') return detail;
                if (detail?.message && typeof detail.message === 'string') {
                  return detail.message;
                }
                return null;
              })
              .filter(Boolean);
            
            if (detailsMessages.length > 0) {
              return `${data.message}\n${detailsMessages.join('\n')}`;
            }
          }
          return data.message;
        }

        // Fallback для старых форматов (обратная совместимость)
        const msg = data.message;
        
        // Если message - массив (старый формат ValidationPipe)
        if (Array.isArray(msg)) {
          return msg
            .map((e: any) => {
              if (typeof e === 'string') return e;
              if (e?.constraints && typeof e.constraints === 'object') {
                return Object.values(e.constraints).join(', ');
              }
              if (e?.message && typeof e.message === 'string') {
                return e.message;
              }
              return 'Ошибка валидации';
            })
            .join('\n');
        }

        // Если message - объект (старый формат)
        if (msg && typeof msg === 'object') {
          if (msg.constraints && typeof msg.constraints === 'object') {
            return Object.values(msg.constraints).join(', ');
          }
          if (msg.message && typeof msg.message === 'string') {
            return msg.message;
          }
        }

        // Fallback на error поле
        if (data.error && typeof data.error === 'string') {
          return data.error;
        }

        return 'Ошибка проверки 2FA';
      };

      toast.error(extractErrorMessage(error));
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

              <TabsContent value="phone" className="space-y-4 mt-4">
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
                      setTwoFAPassword('');
                      setRequires2FA(false);
                      if (onAuthSuccess) {
                        onAuthSuccess();
                      }
                    }}
                    onCancel={() => {
                      setRequires2FA(false);
                      setTwoFAPassword('');
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

