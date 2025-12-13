'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'http://localhost:3001/api/v1';

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
      
      // Сохраняем также user данные в cookie для использования в клиентских компонентах
      if (data.user) {
        cookieStore.set('admin-user', JSON.stringify(data.user), {
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
          sameSite: 'lax',
          httpOnly: false,
        });
      }
      
      cookieStore.set('admin-token', data.token, {
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 дней
        sameSite: 'lax',
        httpOnly: false, // Нужен доступ из клиента для синхронизации с localStorage
      });

      // Используем redirect() для перенаправления
      // Это автоматически перерендерит страницу с новым cookie
      redirect('/admin/dashboard');
    } else {
      return { error: 'Неверный email или пароль' };
    }
  } catch (error: any) {
    console.error('Ошибка при входе:', error);
    return { error: error.message || 'Ошибка при входе. Проверьте данные.' };
  }
}

