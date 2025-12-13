import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Для серверных запросов (Route Handlers) используем полный URL к backend
// NEXT_PUBLIC_API_URL используется только для клиентских запросов
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

    console.log('[Route Handler] Попытка логина для:', email);

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
      console.log('[Route Handler] Ошибка аутентификации:', errorData.message);
      return NextResponse.json(
        { error: errorData.message || 'Ошибка при входе. Проверьте данные.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.token) {
      console.log('[Route Handler] Нет токена в ответе');
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    console.log('[Route Handler] Успешная аутентификация, устанавливаем cookies', {
      hasToken: !!data.token,
      tokenLength: data.token.length,
      userId: data.user?.id,
      userRole: data.user?.role,
    });

    // Получаем cookie store
    const cookieStore = await cookies();

    // Отключаем secure для работы с самоподписанными SSL сертификатами
    const isSecure = false;

    // Устанавливаем токен в cookie
    cookieStore.set('admin-token', data.token, {
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 дней
      sameSite: 'lax',
      httpOnly: false, // Нужен доступ из клиента для синхронизации с localStorage
      secure: isSecure,
    });

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

    console.log('[Route Handler] Все cookies установлены успешно');

    // Возвращаем успешный ответ с данными
    return NextResponse.json({
      success: true,
      token: data.token,
      user: data.user,
    });

  } catch (error: any) {
    console.error('[Route Handler] Ошибка при входе:', error);
    return NextResponse.json(
      { error: 'Ошибка при входе. Проверьте подключение к интернету.' },
      { status: 500 }
    );
  }
}
