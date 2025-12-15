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
    const { email, password, rememberMe } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

    console.log('[Route Handler] Попытка логина для:', email);

    // Перенаправляем на новый API endpoint, который устанавливает httpOnly cookies
    const cookieHeader = request.headers.get('cookie') || '';
    // API_URL может уже содержать /api/v1, поэтому проверяем
    const backendUrl = API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`;
    const response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
      body: JSON.stringify({ email, password, rememberMe: rememberMe ?? false }),
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

    // Копируем cookies из ответа backend
    const setCookieHeaders = response.headers.getSetCookie();
    console.log('[Route Handler] Set-Cookie заголовки от backend:', {
      count: setCookieHeaders.length,
      headers: setCookieHeaders,
      allResponseHeaders: Object.fromEntries(response.headers.entries()),
    });

    const nextResponse = NextResponse.json({
      success: true,
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });

    // Устанавливаем cookies из ответа backend
    // Важно: используем правильный формат для Next.js
    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach(cookie => {
        try {
          // Парсим cookie и устанавливаем через NextResponse
          const [nameValue, ...attributes] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          
          if (!name || !value) {
            console.warn('[Route Handler] Неверный формат cookie:', cookie);
            return;
          }
          
          // Извлекаем атрибуты
          // Важно: path должен быть '/admin' из-за basePath в next.config.js
          const cookieOptions: any = {
            httpOnly: cookie.includes('HttpOnly'),
            secure: cookie.includes('Secure'),
            sameSite: cookie.includes('SameSite=Lax') ? 'lax' : cookie.includes('SameSite=Strict') ? 'strict' : 'lax',
            path: '/admin', // Изменено с '/' на '/admin' из-за basePath
          };
          
          // Извлекаем maxAge (в секундах для Next.js)
          const maxAgeMatch = cookie.match(/Max-Age=(\d+)/);
          if (maxAgeMatch) {
            cookieOptions.maxAge = parseInt(maxAgeMatch[1]);
          }
          
          console.log('[Route Handler] Устанавливаем cookie:', { name: name.trim(), hasValue: !!value, options: cookieOptions });
          nextResponse.cookies.set(name.trim(), value.trim(), cookieOptions);
        } catch (error) {
          console.error('[Route Handler] Ошибка при установке cookie:', error, cookie);
        }
      });
      console.log('[Route Handler] Cookies установлены в ответе, всего:', setCookieHeaders.length);
    } else {
      console.warn('[Route Handler] Нет Set-Cookie заголовков от backend!');
    }

    return nextResponse;

  } catch (error: any) {
    console.error('[Route Handler] Ошибка при входе:', error);
    return NextResponse.json(
      { error: 'Ошибка при входе. Проверьте подключение к интернету.' },
      { status: 500 }
    );
  }
}
