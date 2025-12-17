'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Не делаем проверки пока Auth Context загружается
    if (isLoading) return;

    const isLoginPage = pathname === '/login';
    const isRegisterPage = pathname === '/register';
    const isTelegramAuthPage = pathname === '/admin/telegram-auth' || pathname === '/telegram-auth';
    const isPublicPage = isLoginPage || isRegisterPage || isTelegramAuthPage;

    // Если пользователь не аутентифицирован и не на странице логина/регистрации/telegram-auth
    if (!isAuthenticated && !isPublicPage) {
      router.push('/login');
      return;
    }

    // Если пользователь аутентифицирован и на странице логина/регистрации - редиректим на dashboard
    // Но для telegram-auth разрешаем доступ даже авторизованным (для авторизации Telegram аккаунта)
    if (isAuthenticated && (isLoginPage || isRegisterPage)) {
      router.push('/dashboard');
      return;
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Показываем загрузку пока проверяем аутентификацию
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return <>{children}</>;
}

