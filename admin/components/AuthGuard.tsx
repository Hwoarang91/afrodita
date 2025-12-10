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
      const basePath = '/admin'; // Всегда используем /admin для админ панели
      // Проверяем, находимся ли мы на странице логина или регистрации (с учетом basePath)
      const isLoginPage = pathname === '/login' || currentPath === '/admin/login' || currentPath.endsWith('/login');
      const isRegisterPage = pathname === '/register' || currentPath === '/admin/register' || currentPath.endsWith('/register');

      // Если мы на странице логина или регистрации - очищаем токен и не делаем проверку авторизации
      // Это предотвращает бесконечный редирект, если токен есть, но пользователя нет в БД
      if (isLoginPage || isRegisterPage) {
        // Очищаем токен на страницах логина/регистрации, чтобы избежать проблем
        // с невалидными токенами от предыдущих сессий
        if (token) {
          console.log('Очистка токена на странице логина/регистрации');
          localStorage.removeItem('admin-token');
          localStorage.removeItem('admin-user');
          document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
        }
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
      // НЕ проверяем на странице логина/регистрации, чтобы избежать лишних запросов
      if (!isLoginPage && !isRegisterPage) {
        try {
          const { data } = await apiClient.get('/auth/check-setup');
          const hasUsers = data.hasUsers;

          // Если нет администраторов и мы не на странице регистрации - редиректим на регистрацию
          if (!hasUsers && !isRegisterPage) {
            window.location.href = '/admin/register';
            return;
          }

          // Если есть администраторы и мы на странице регистрации - редиректим на логин
          if (hasUsers && isRegisterPage) {
            window.location.href = '/admin/login';
            return;
          }
        } catch (error: any) {
          // Если ошибка при проверке (например, 401) - очищаем токен
          // Это означает, что токен невалидный или пользователя нет в БД
          if (error?.response?.status === 401) {
            console.log('401 при проверке setup - очищаем токен');
            // Очищаем токен, так как он невалидный
            localStorage.removeItem('admin-token');
            localStorage.removeItem('admin-user');
            document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
            
            // Если нет пользователей - редиректим на регистрацию
            // Если есть пользователи, но токен невалидный - редиректим на логин
            // Но только если мы не на странице логина/регистрации
            if (!isLoginPage && !isRegisterPage) {
              // Проверяем, есть ли пользователи (без токена)
              try {
                const checkResponse = await apiClient.get('/auth/check-setup');
                if (!checkResponse.data.hasUsers) {
                  window.location.href = '/admin/register';
                  return;
                }
              } catch (checkError) {
                // Если не удалось проверить - редиректим на логин
                window.location.href = '/admin/login';
                return;
              }
              window.location.href = '/admin/login';
              return;
            }
          } else {
            console.error('Ошибка при проверке настройки системы:', error);
            // Если ошибка и мы на странице регистрации - редиректим на логин (безопаснее)
            if (isRegisterPage) {
              window.location.href = '/admin/login';
              return;
            }
          }
        }
      }
      
      // Используем window.location.href для редиректа, всегда через /admin
      if (!token && !isLoginPage && !isRegisterPage) {
        // Всегда редиректим на /admin/login
        window.location.href = '/admin/login';
      } else if (token && (isLoginPage || isRegisterPage)) {
        window.location.href = '/admin/dashboard';
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

