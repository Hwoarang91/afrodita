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
  /** Вызывается при «2FA session not found» / «2FA session expired» — сброс и переход к шагу «телефон». */
  onRestart?: () => void;
}

function extractErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: unknown }; status?: number }; message?: string };
  const data = e?.response?.data;
  if (!data) return e?.message && typeof e.message === 'string' ? e.message : 'Ошибка проверки пароля 2FA';
  const m = data.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) {
    const parts = m.map((x: unknown) => (typeof x === 'string' ? x : (x as { message?: string })?.message)).filter(Boolean);
    return parts.length ? String(parts.join('. ')) : 'Ошибка проверки пароля 2FA';
  }
  return 'Ошибка проверки пароля 2FA';
}

function is2FASessionLostMessage(msg: string): boolean {
  const s = msg.toLowerCase();
  return (
    s.includes('2fa session not found') ||
    s.includes('2fa session expired') ||
    s.includes('сессия 2fa не найдена') ||
    s.includes('сессия 2fa истекла') ||
    s.includes('session not found') ||
    s.includes('session expired') ||
    s.includes('неверный phone code hash') ||
    s.includes('invalid phone code hash')
  );
}

export function Telegram2FATab({
  phoneNumber,
  phoneCodeHash,
  passwordHint,
  onSuccess,
  onCancel,
  onRestart,
}: Telegram2FATabProps) {
  const [twoFAPassword, setTwoFAPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLastError(null);
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
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error);
      setLastError(errorMessage);
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
            onClick={() => { setLastError(null); onCancel(); }}
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

          {lastError && is2FASessionLostMessage(lastError) && (
            <div
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3"
              role="alert"
              aria-live="polite"
            >
              <p className="text-sm text-amber-700 dark:text-amber-400">{lastError}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Начните авторизацию заново: «Отправить код» → «Ввести код» → «2FA».
              </p>
              {onRestart && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => { setLastError(null); setTwoFAPassword(''); onRestart(); }}
                  disabled={isLoading}
                >
                  Начать заново
                </Button>
              )}
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
              onClick={() => { setLastError(null); onCancel(); }}
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

