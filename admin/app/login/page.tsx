'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Очищаем токен при загрузке страницы логина
  // Это предотвращает проблемы с невалидными токенами от предыдущих сессий
  // НО только если мы действительно зашли на страницу логина (не после успешного логина)
  useEffect(() => {
    // Проверяем, не был ли только что успешный логин
    // Проверяем сначала cookie (устанавливается сервером), затем sessionStorage
    const cookieJustLoggedIn = document.cookie
      .split('; ')
      .find(row => row.startsWith('just-logged-in='))
      ?.split('=')[1];
    const sessionJustLoggedIn = sessionStorage.getItem('just-logged-in');
    const justLoggedIn = cookieJustLoggedIn === 'true' || sessionJustLoggedIn === 'true';
    
    if (!justLoggedIn) {
      localStorage.removeItem('admin-token');
      localStorage.removeItem('admin-user');
      document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
    } else {
      // Синхронизируем cookie в sessionStorage для совместимости с AuthGuard
      if (cookieJustLoggedIn === 'true') {
        sessionStorage.setItem('just-logged-in', 'true');
      }
      // Удаляем флаг после использования (через небольшую задержку, чтобы AuthGuard успел проверить)
      setTimeout(() => {
        sessionStorage.removeItem('just-logged-in');
        document.cookie = 'just-logged-in=; path=/; max-age=0; SameSite=Lax';
      }, 1000);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    startTransition(async () => {
      try {
        const result = await loginAction(formData);
        
        if (result?.error) {
          setError(result.error);
        } else if (result?.success) {
          // Успешный логин - cookies установлены на сервере
          // Синхронизируем токен в localStorage и sessionStorage
          if (result.token) {
            localStorage.setItem('admin-token', result.token);
            sessionStorage.setItem('admin-token', result.token);
            if (result.user) {
              localStorage.setItem('admin-user', JSON.stringify(result.user));
            }
          }
          // Небольшая задержка для установки cookies на сервере
          await new Promise(resolve => setTimeout(resolve, 200));
          // Редирект на дашборд
          router.push('/admin/dashboard');
        }
      } catch (error: any) {
        // Если произошла ошибка сети или другая ошибка
        console.error('Ошибка при входе:', error);
        setError('Ошибка при входе. Проверьте подключение к интернету.');
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary mb-2">Афродита</CardTitle>
          <CardDescription>Административная панель</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full"
            >
              {isPending ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

