'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Telegram2FATabProps {
  phoneNumber: string;
  phoneCodeHash: string;
  passwordHint?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function Telegram2FATab({ 
  phoneNumber, 
  phoneCodeHash, 
  passwordHint,
  onSuccess,
  onCancel 
}: Telegram2FATabProps) {
  const [twoFAPassword, setTwoFAPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!twoFAPassword.trim()) {
      toast.error('Введите пароль 2FA');
      return;
    }

    try {
      setIsLoading(true);
      const requestBody = {
        phoneNumber: phoneNumber.trim(),
        password: twoFAPassword.trim(),
        phoneCodeHash,
      };

      const response = await apiClient.post('/auth/telegram/2fa/verify', requestBody);

      if (response.data.success) {
        toast.success('Telegram аккаунт успешно подключен!');
        onSuccess();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Ошибка проверки пароля 2FA';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <CardTitle>Двухфакторная аутентификация</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <CardDescription>
          Введите пароль 2FA для завершения авторизации Telegram аккаунта
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {passwordHint && (
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Подсказка:</span> {passwordHint}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="2fa-password">Пароль 2FA</Label>
            <PasswordInput
              id="2fa-password"
              value={twoFAPassword}
              onChange={(e) => setTwoFAPassword(e.target.value)}
              placeholder="Введите пароль 2FA"
              disabled={isLoading}
              className="mt-2"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading || !twoFAPassword.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Проверка...
                </>
              ) : (
                'Продолжить'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Отмена
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

