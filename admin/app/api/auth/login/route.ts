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
    return 'http://backend:3001/api';
  }

  // В development используем localhost
  return 'http://localhost:3001/api';
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

    // Перенаправляем на новый API endpoint, который устанавливает httpOnly cookies
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

    if (!data.accessToken) {
      console.log('[Route Handler] Нет accessToken в ответе');
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    console.log('[Route Handler] Успешная аутентификация, токены установлены в httpOnly cookies');

    // Возвращаем успешный ответ с данными
    // Токены уже установлены в httpOnly cookies backend'ом
    return NextResponse.json({
      success: true,
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
