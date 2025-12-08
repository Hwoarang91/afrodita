'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin-token');
    // Определяем базовый путь из window.location, так как Nginx удаляет префикс /admin
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const basePath = currentPath.startsWith('/admin') ? '/admin' : '';
    // Проверяем, находимся ли мы на странице логина (с учетом basePath)
    const isLoginPage = pathname === '/login' || currentPath === '/admin/login' || currentPath.endsWith('/login');

    // Синхронизируем токен с cookies для Server Components
    if (token) {
      // Проверяем, есть ли уже cookie
      const cookieToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('admin-token='))
        ?.split('=')[1];
      
      // Если токен в localStorage, но нет в cookies - добавляем в cookies
      if (token && !cookieToken) {
        document.cookie = `admin-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }
    }
    
    // Используем window.location.href для редиректа, чтобы сохранить префикс /admin
    if (!token && !isLoginPage) {
      // Редиректим на /admin/login, а не на /login
      if (basePath) {
        window.location.href = `${basePath}/login`;
      } else {
        window.location.href = '/admin/login';
      }
    } else if (token && isLoginPage) {
      window.location.href = `${basePath}/dashboard`;
    } else {
      setIsChecking(false);
    }
  }, [pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return <>{children}</>;
}

