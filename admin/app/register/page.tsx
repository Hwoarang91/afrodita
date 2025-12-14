'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AxiosError, getErrorMessage } from '@/lib/types';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  // Очищаем токен и проверяем наличие администраторов при загрузке страницы
  useEffect(() => {
    // Очищаем токен при загрузке страницы регистрации
    // Это предотвращает проблемы с невалидными токенами от предыдущих сессий
    localStorage.removeItem('admin-token');
    localStorage.removeItem('admin-user');
    document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';

    const checkSetup = async () => {
      try {
        const { data } = await apiClient.get('/auth/check-setup');
        if (data.hasUsers) {
          // Если администраторы уже есть - редиректим на логин (basePath уже учтен)
          router.push('/login');
        }
      } catch (error) {
        console.error('Ошибка при проверке настройки системы:', error);
        // При ошибке (например, 401) продолжаем показывать страницу регистрации
        // так как токен уже очищен
      } finally {
        setIsChecking(false);
      }
    };

    checkSetup();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data } = await apiClient.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
      });

      if (data.token) {
        // Токены устанавливаются в httpOnly cookies backend'ом
        // Редиректим на дашборд (basePath уже учтен в next.config.js)
        router.push('/dashboard');
      } else {
        setError('Ошибка при регистрации');
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage || 'Ошибка при регистрации. Проверьте данные.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary mb-2">Афродита</CardTitle>
          <CardDescription>Регистрация первого администратора</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="firstName">Имя</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="Иван"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Фамилия</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
              />
            </div>

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
                minLength={6}
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">
                Минимум 6 символов
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

