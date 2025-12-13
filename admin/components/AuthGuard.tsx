'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Защита от бесконечных редиректов - проверяем, не было ли уже редиректа недавно
    const lastRedirectTime = typeof window !== 'undefined' ? sessionStorage.getItem('last-auth-redirect-time') : null;
    const now = typeof window !== 'undefined' ? Date.now() : 0;
    if (lastRedirectTime && (now - parseInt(lastRedirectTime)) < 1000) {
      console.log('AuthGuard: Редирект уже был недавно - пропускаем, чтобы избежать бесконечного цикла');
      setIsChecking(false);
      return;
    }
    
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
          // Синхронизируем токен из cookies в localStorage/sessionStorage, если его там нет
          if (token && typeof window !== 'undefined') {
            if (!localStorage.getItem('admin-token')) {
              localStorage.setItem('admin-token', token);
            }
            if (!sessionStorage.getItem('admin-token')) {
              sessionStorage.setItem('admin-token', token);
            }
          }
          // НЕ удаляем флаг сразу - даем время для редиректа
          // Флаг будет удален в login/page.tsx или через таймаут
          // Продолжаем проверку - редирект на dashboard произойдет дальше
        } else {
          // Очищаем токен на страницах логина/регистрации, чтобы избежать проблем
          // с невалидными токенами от предыдущих сессий
          // НО только если нет флага just-logged-in
          if (token && !justLoggedIn) {
            console.log('AuthGuard: Очистка токена на странице логина/регистрации (нет флага just-logged-in)');
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
      if (typeof window !== 'undefined') {
        const cookieToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('admin-token='))
          ?.split('=')[1];
        
        // Если токен в cookie - используем его и синхронизируем в localStorage и sessionStorage
        if (cookieToken) {
          token = cookieToken;
          localStorage.setItem('admin-token', cookieToken);
          sessionStorage.setItem('admin-token', cookieToken);
        } else if (token) {
          // Если токена нет в cookie, но есть в localStorage/sessionStorage
          // Синхронизируем в оба хранилища и устанавливаем в cookie (для совместимости)
          localStorage.setItem('admin-token', token);
          sessionStorage.setItem('admin-token', token);
          // Устанавливаем токен в cookie, если его там нет (на случай, если он был потерян)
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
            router.push('/register');
            return;
          }

          // Если есть администраторы и мы на странице регистрации - редиректим на логин
          if (hasUsers && isRegisterPage) {
            router.push('/login');
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
              router.push('/login');
              return;
            }
          }
          // В других случаях при ошибке проверки setup просто продолжаем
          // Это не критичная проверка, и если токен есть - пользователь может работать
        }
      }
      
      // Если нет токена и мы не на странице логина/регистрации - редиректим на логин
      if (!token && !isLoginPage && !isRegisterPage) {
        // Сохраняем время редиректа для защиты от бесконечного цикла
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('last-auth-redirect-time', Date.now().toString());
        }
        // Используем router.push, basePath уже учтен
        router.push('/login');
        return;
      }
      
      // Если есть токен и мы на странице логина/регистрации - редиректим на dashboard
      // НО только если нет флага just-logged-in (чтобы не делать редирект сразу после логина, если токен еще не валидный)
      if (token && (isLoginPage || isRegisterPage)) {
        // Проверяем флаг just-logged-in - если только что залогинились, даем время для синхронизации токена
        if (justLoggedIn) {
          // Если только что залогинились, ждем немного перед редиректом
          // Увеличиваем задержку для полной синхронизации токена
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              // Проверяем, что токен действительно установлен в cookies перед редиректом
              const cookieToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('admin-token='))
                ?.split('=')[1];
              
              if (cookieToken) {
                // Синхронизируем токен в storage перед редиректом
                localStorage.setItem('admin-token', cookieToken);
                sessionStorage.setItem('admin-token', cookieToken);
                sessionStorage.setItem('last-auth-redirect-time', Date.now().toString());
                router.push('/dashboard');
              } else {
                // Если токена нет в cookies, но есть в token - устанавливаем вручную
                if (token) {
                  document.cookie = `admin-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
                  localStorage.setItem('admin-token', token);
                  sessionStorage.setItem('admin-token', token);
                  sessionStorage.setItem('last-auth-redirect-time', Date.now().toString());
                  router.push('/dashboard');
                }
              }
            }
          }, 1000); // Увеличена задержка для синхронизации
          return;
        }
        
        // Сохраняем время редиректа для защиты от бесконечного цикла
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('last-auth-redirect-time', Date.now().toString());
        }
        // Используем router.push, basePath уже учтен
        router.push('/dashboard');
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

