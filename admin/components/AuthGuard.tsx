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
      // Проверяем токен сначала в cookies (приоритет - установлено сервером), затем в sessionStorage/localStorage
      let token = null;
      if (typeof window !== 'undefined') {
        const cookieToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('admin-token='))
          ?.split('=')[1];
        if (cookieToken) {
          token = cookieToken;
        } else {
          token = sessionStorage.getItem('admin-token');
          if (!token) {
            token = localStorage.getItem('admin-token');
          }
        }
      }
      // Определяем базовый путь из window.location, так как Nginx удаляет префикс /admin
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      const basePath = '/admin'; // Всегда используем /admin для админ панели
      // Проверяем, находимся ли мы на странице логина или регистрации (с учетом basePath)
      // Используем несколько проверок для надежности
      const isLoginPage = 
        pathname === '/login' || 
        currentPath === '/admin/login' || 
        currentPath === '/login' ||
        currentUrl.includes('/admin/login') ||
        currentUrl.includes('/login') ||
        currentPath.endsWith('/login');
      const isRegisterPage = 
        pathname === '/register' || 
        currentPath === '/admin/register' || 
        currentPath === '/register' ||
        currentUrl.includes('/admin/register') ||
        currentUrl.includes('/register') ||
        currentPath.endsWith('/register');

      // Проверяем, был ли только что успешный логин
      // Проверяем сначала cookie (устанавливается сервером), затем sessionStorage
      let justLoggedIn = null;
      if (typeof window !== 'undefined') {
        const cookieJustLoggedIn = document.cookie
          .split('; ')
          .find(row => row.startsWith('just-logged-in='))
          ?.split('=')[1];
        const sessionJustLoggedIn = sessionStorage.getItem('just-logged-in');
        justLoggedIn = cookieJustLoggedIn === 'true' || sessionJustLoggedIn === 'true';
        
        // Синхронизируем cookie в sessionStorage для совместимости
        if (cookieJustLoggedIn === 'true' && !sessionJustLoggedIn) {
          sessionStorage.setItem('just-logged-in', 'true');
        }
      }
      
      // Если мы на странице логина или регистрации
      if (isLoginPage || isRegisterPage) {
        // Если только что залогинились - не очищаем токен, редирект произойдет дальше
        if (justLoggedIn) {
          // Удаляем флаг сразу после проверки
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('just-logged-in');
          }
          // Продолжаем проверку - редирект на dashboard произойдет дальше
        } else {
          // Очищаем токен на страницах логина/регистрации, чтобы избежать проблем
          // с невалидными токенами от предыдущих сессий
          if (token) {
            console.log('AuthGuard: Очистка токена на странице логина/регистрации');
            localStorage.removeItem('admin-token');
            sessionStorage.removeItem('admin-token');
            localStorage.removeItem('admin-user');
            document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
          }
          setIsChecking(false);
          return;
        }
      }

      // Синхронизируем токен между cookies, localStorage и sessionStorage
      // Cookies имеют приоритет, так как устанавливаются сервером
      if (typeof window !== 'undefined' && token) {
        const cookieToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('admin-token='))
          ?.split('=')[1];
        
        // Если токен в cookie - синхронизируем в localStorage и sessionStorage
        if (cookieToken && cookieToken === token) {
          localStorage.setItem('admin-token', token);
          sessionStorage.setItem('admin-token', token);
        } else if (token) {
          // Если токена нет в cookie, но есть в localStorage/sessionStorage
          // Синхронизируем в оба хранилища
          localStorage.setItem('admin-token', token);
          sessionStorage.setItem('admin-token', token);
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
            router.push('/admin/register');
            return;
          }

          // Если есть администраторы и мы на странице регистрации - редиректим на логин
          if (hasUsers && isRegisterPage) {
            router.push('/admin/login');
            return;
          }
        } catch (error: unknown) {
          // Обрабатываем ошибку проверки setup
          // /auth/check-setup не требует аутентификации, поэтому 401 здесь не ожидается
          const axiosError = error as { response?: { status?: number }; message?: string };
          console.error('Ошибка при проверке настройки системы:', error);
          
          // Если это сетевая ошибка (не 401) - просто логируем и продолжаем
          // Если 401 - это странно, но тоже продолжаем (не должен требовать авторизации)
          // Если нет администраторов - редиректим на регистрацию
          // Если есть администраторы и мы на странице регистрации - редиректим на логин
          if (isRegisterPage) {
            // На странице регистрации при любой ошибке - пробуем редирект на логин
            // Но только если у нас нет токена (если есть токен - значит уже авторизованы)
            if (!token) {
              router.push('/admin/login');
              return;
            }
          }
          // В других случаях при ошибке проверки setup просто продолжаем
          // Это не критичная проверка, и если токен есть - пользователь может работать
        }
      }
      
      // Используем window.location.href для редиректа, всегда через /admin
      // Если нет токена и мы не на странице логина/регистрации - редиректим на логин
      if (!token && !isLoginPage && !isRegisterPage) {
        // Всегда редиректим на /admin/login
        window.location.href = '/admin/login';
        return;
      }
      
      // Если есть токен и мы на странице логина/регистрации - редиректим на dashboard
      if (token && (isLoginPage || isRegisterPage)) {
        // Редиректим на dashboard
        window.location.href = '/admin/dashboard';
        return;
      }
      
      // Если дошли сюда - значит все проверки пройдены и мы можем показать контент
      setIsChecking(false);
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

