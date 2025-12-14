'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  // Очищаем токен при загрузке страницы логина
  // Это предотвращает проблемы с невалидными токенами от предыдущих сессий
  // НО только если мы действительно зашли на страницу логина (не после успешного логина)
  useEffect(() => {
    // Проверяем, не был ли только что успешный логин
    // Проверяем сначала cookie (устанавливается сервером), затем sessionStorage
    // Добавляем задержку, чтобы дать время cookies установиться после Server Action
    const checkJustLoggedIn = () => {
      const cookieJustLoggedIn = document.cookie
        .split('; ')
        .find(row => row.startsWith('just-logged-in='))
        ?.split('=')[1];
      const sessionJustLoggedIn = sessionStorage.getItem('just-logged-in');
      const justLoggedIn = cookieJustLoggedIn === 'true' || sessionJustLoggedIn === 'true';
      
      // Проверяем наличие токена в cookies
      const hasTokenInCookie = document.cookie.includes('admin-token=');
      
      if (!justLoggedIn && !hasTokenInCookie) {
        // Очищаем токен только если точно не было успешного логина И нет токена в cookies
        const hasTokenInStorage = localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
        
        // Если есть токен в storage, но нет в cookies и нет флага just-logged-in - это старая сессия, очищаем
        if (hasTokenInStorage) {
          console.log('Login page: Очистка старого токена (нет флага just-logged-in и нет токена в cookies)');
          localStorage.removeItem('admin-token');
          localStorage.removeItem('admin-user');
          sessionStorage.removeItem('admin-token');
          // НЕ удаляем cookie, если его там нет - это может вызвать проблемы
        }
      } else if (justLoggedIn) {
        // Синхронизируем cookie в sessionStorage для совместимости с AuthGuard
        if (cookieJustLoggedIn === 'true') {
          sessionStorage.setItem('just-logged-in', 'true');
        }
        // НЕ удаляем флаг сразу - даем время для редиректа
        // Флаг будет удален через таймаут или в AuthGuard
      }
    };
    
    // Проверяем с задержкой, чтобы дать время cookies установиться после Server Action
    const timeoutId = setTimeout(checkJustLoggedIn, 300);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    console.log('Login page: handleSubmit вызван');

    setIsPending(true);
    try {
      console.log('Login page: Отправляем запрос на /admin/api/auth/login');

      const response = await fetch('/admin/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      console.log('Login page: Получен результат от Route Handler', result);

      if (!response.ok || result?.error) {
        setError(result?.error || 'Ошибка при входе. Проверьте данные.');
        return;
      }

      if (result?.success && result?.token) {
        console.log('Login page: Успешный логин, синхронизируем данные в хранилищах');

        // Синхронизируем токен в localStorage и sessionStorage для клиентских компонентов
        // Cookies уже установлены Route Handler'ом
        sessionStorage.setItem('just-logged-in', 'true');
        localStorage.setItem('admin-token', result.token);
        sessionStorage.setItem('admin-token', result.token);
        if (result.user) {
          localStorage.setItem('admin-user', JSON.stringify(result.user));
        }

        console.log('Login page: Данные синхронизированы, выполняем редирект на /dashboard');

        // Редирект на дашборд (basePath уже учтен в next.config.js)
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Login page: Ошибка при входе:', error);
      setError('Ошибка при входе. Проверьте подключение к интернету.');
    } finally {
      setIsPending(false);
    }
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

