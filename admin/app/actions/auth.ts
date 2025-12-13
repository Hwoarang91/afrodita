'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Для серверных запросов (Server Actions) используем полный URL к backend
// NEXT_PUBLIC_API_URL используется только для клиентских запросов
// API_URL используется для серверных запросов (внутри Docker сети)
const getApiUrl = (): string => {
  // Если есть API_URL (для серверных запросов), используем его
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  
  // Если NEXT_PUBLIC_API_URL - это полный URL (начинается с http), используем его
  if (process.env.NEXT_PUBLIC_API_URL?.startsWith('http')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // В production внутри Docker используем внутренний URL к backend
  if (process.env.NODE_ENV === 'production') {
    return 'http://backend:3001/api/v1';
  }
  
  // В development используем localhost
  return 'http://localhost:3001/api/v1';
};

const API_URL = getApiUrl();

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email и пароль обязательны' };
  }

  try {
    // Вызываем API для аутентификации
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'Ошибка при входе. Проверьте данные.',
      }));
      return { error: errorData.message || 'Ошибка при входе. Проверьте данные.' };
    }

    const data = await response.json();

    if (data.token) {
      // Устанавливаем cookie через Server Action
      // Это гарантирует синхронизацию с сервером
      // Next.js автоматически перерендерит страницу после установки cookie
      const cookieStore = await cookies();

      // Отключаем secure для работы с самоподписанными SSL сертификатами
      const isSecure = false;

      console.log('[Server Action] Устанавливаем токен в cookie, secure:', isSecure, {
        hasToken: !!data.token,
        tokenLength: data.token.length,
        userId: data.user?.id,
        userRole: data.user?.role,
      });

      // Устанавливаем токен в cookie
      cookieStore.set('admin-token', data.token, {
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 дней
        sameSite: 'lax',
        httpOnly: false, // Нужен доступ из клиента для синхронизации с localStorage
        secure: isSecure,
      });

      console.log('[Server Action] Токен установлен в cookie');

      // Сохраняем также user данные в cookie для использования в клиентских компонентах
      if (data.user) {
        cookieStore.set('admin-user', JSON.stringify(data.user), {
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
          sameSite: 'lax',
          httpOnly: false,
          secure: isSecure,
        });
      }

      // Устанавливаем флаг успешного логина в cookie
      // Это предотвратит очистку токена в AuthGuard и login/page.tsx
      cookieStore.set('just-logged-in', 'true', {
        path: '/',
        maxAge: 60, // 1 минута - достаточно для редиректа
        sameSite: 'lax',
        httpOnly: false, // Нужен доступ из клиента для установки в sessionStorage
        secure: isSecure,
      });

      console.log('[Server Action] Все cookies установлены успешно');

      // Обновляем кеш страницы, чтобы cookies были доступны сразу
      revalidatePath('/dashboard');
      revalidatePath('/login');

      // Возвращаем успешный результат вместо redirect()
      // Редирект будет выполнен на клиенте после установки cookies
      return { success: true, token: data.token, user: data.user };
    } else {
      return { error: 'Неверный email или пароль' };
    }
  } catch (error: any) {
    console.error('Ошибка при входе:', error);
    return { error: error.message || 'Ошибка при входе. Проверьте данные.' };
  }
}

