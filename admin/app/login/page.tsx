'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data } = await apiClient.post('/auth/login', {
        email,
        password,
      });

      if (data.token) {
        localStorage.setItem('admin-token', data.token);
        if (data.user) {
          localStorage.setItem('admin-user', JSON.stringify(data.user));
        }
        // Сохраняем токен в cookies для Server Components
        document.cookie = `admin-token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        // Используем window.location для редиректа с учетом basePath
        window.location.href = '/admin/dashboard';
      } else {
        setError('Неверный email или пароль');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Ошибка при входе. Проверьте данные.',
      );
    } finally {
      setIsLoading(false);
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
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

