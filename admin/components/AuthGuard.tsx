'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin-token');
      // Определяем базовый путь из window.location, так как Nginx удаляет префикс /admin
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const basePath = currentPath.startsWith('/admin') ? '/admin' : '';
      // Проверяем, находимся ли мы на странице логина или регистрации (с учетом basePath)
      const isLoginPage = pathname === '/login' || currentPath === '/admin/login' || currentPath.endsWith('/login');
      const isRegisterPage = pathname === '/register' || currentPath === '/admin/register' || currentPath.endsWith('/register');

      // Если мы на странице логина или регистрации - не делаем проверку авторизации
      // Позволяем странице обрабатывать ошибки самостоятельно
      if (isLoginPage || isRegisterPage) {
        setIsChecking(false);
        return;
      }

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

      // Проверяем, есть ли администраторы в системе
      try {
        const { data } = await apiClient.get('/auth/check-setup');
        const hasUsers = data.hasUsers;

        // Если нет администраторов и мы не на странице регистрации - редиректим на регистрацию
        if (!hasUsers && !isRegisterPage) {
          window.location.href = `${basePath}/register`;
          return;
        }

        // Если есть администраторы и мы на странице регистрации - редиректим на логин
        if (hasUsers && isRegisterPage) {
          window.location.href = `${basePath}/login`;
          return;
        }
      } catch (error) {
        // Если ошибка при проверке, продолжаем с обычной логикой
        console.error('Ошибка при проверке настройки системы:', error);
        // Если ошибка и мы на странице регистрации - редиректим на логин (безопаснее)
        if (isRegisterPage) {
          window.location.href = `${basePath}/login`;
          return;
        }
      }
      
      // Используем window.location.href для редиректа, чтобы сохранить префикс /admin
      if (!token && !isLoginPage && !isRegisterPage) {
        // Редиректим на /admin/login, а не на /login
        if (basePath) {
          window.location.href = `${basePath}/login`;
        } else {
          window.location.href = '/admin/login';
        }
      } else if (token && (isLoginPage || isRegisterPage)) {
        window.location.href = `${basePath}/dashboard`;
      } else {
        setIsChecking(false);
      }
    };

    checkAuth();
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

