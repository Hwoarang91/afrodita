'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Loader2, Smartphone, QrCode, Shield } from 'lucide-react';

export default function TelegramAuthPage() {
  const [authMethod, setAuthMethod] = useState<'phone' | 'qr'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [qrTokenId, setQrTokenId] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState<number>(0);
  const [qrStatus, setQrStatus] = useState<'pending' | 'accepted' | 'expired'>('pending');
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFAPassword, setTwoFAPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const router = useRouter();

  const generateQrCode = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.post('/auth/telegram/qr/generate');
      setQrTokenId(response.data.tokenId);
      setQrUrl(response.data.qrUrl);
      setQrExpiresAt(response.data.expiresAt);
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

  // Polling статуса QR-кода
  useEffect(() => {
    if (authMethod === 'qr' && qrTokenId && qrStatus === 'pending') {
      const interval = setInterval(async () => {
        try {
          const response = await apiClient.get(`/auth/telegram/qr/status/${qrTokenId}`);
          const status = response.data.status;
          setQrStatus(status);

          if (status === 'accepted' && response.data.user && response.data.tokens) {
            toast.success('Авторизация успешна!');
            router.push('/dashboard');
          } else if (status === 'expired') {
            toast.error('QR-код истек. Генерируем новый...');
            generateQrCode();
          }
        } catch (error: any) {
          console.error('Error checking QR status:', error);
        }
      }, 2000); // Проверяем каждые 2 секунды

      return () => clearInterval(interval);
    }
  }, [authMethod, qrTokenId, qrStatus, router, generateQrCode]);

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
        toast.info('Требуется двухфакторная аутентификация');
      } else {
        toast.success('Авторизация успешна!');
        router.push('/dashboard');
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

    try {
      setIsLoading(true);
      const response = await apiClient.post('/auth/telegram/2fa/verify', {
        phoneNumber,
        password: twoFAPassword,
        phoneCodeHash,
      });

      if (response.data.success) {
        toast.success('Авторизация успешна!');
        router.push('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка проверки 2FA пароля');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary mb-2">Афродита</CardTitle>
          <CardDescription>Авторизация через Telegram</CardDescription>
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
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Shield className="w-5 h-5" />
                    <p className="text-sm">Требуется двухфакторная аутентификация</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="2fa-password">Пароль 2FA</Label>
                    <Input
                      id="2fa-password"
                      type="password"
                      value={twoFAPassword}
                      onChange={(e) => setTwoFAPassword(e.target.value)}
                      placeholder="Введите пароль 2FA"
                    />
                  </div>
                  <Button
                    onClick={handleVerify2FA}
                    disabled={isLoading}
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
                </div>
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
                      <p className="text-xs text-muted-foreground">
                        Ожидание сканирования...
                      </p>
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
    </div>
  );
}

