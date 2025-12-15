import { NextRequest, NextResponse } from 'next/server';

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
      return NextResponse.json(
        { error: errorData.message || 'Ошибка при входе. Проверьте данные.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.accessToken) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Копируем cookies из ответа backend
    const setCookieHeaders = response.headers.getSetCookie();

    // Создаем NextResponse для установки cookies через cookies.set(), как в refresh/route.ts
    const nextResponse = NextResponse.json({
      success: true,
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    
    // Устанавливаем cookies из ответа backend через cookies.set()
    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach(cookie => {
        try {
          // Парсим cookie строку из backend
          const [nameValue, ...rest] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          const options: any = {};
          
          rest.forEach(part => {
            const trimmed = part.trim();
            if (trimmed.toLowerCase() === 'httponly') {
              options.httpOnly = true;
            } else if (trimmed.toLowerCase().startsWith('secure')) {
              options.secure = true;
            } else if (trimmed.toLowerCase().startsWith('samesite')) {
              options.sameSite = trimmed.split('=')[1]?.toLowerCase() || 'lax';
            } else if (trimmed.toLowerCase().startsWith('path')) {
              options.path = trimmed.split('=')[1] || '/';
            } else if (trimmed.toLowerCase().startsWith('max-age')) {
              options.maxAge = parseInt(trimmed.split('=')[1] || '0', 10);
            }
          });

          nextResponse.cookies.set(name, value, options);
        } catch (error) {
          // Игнорируем ошибки установки отдельных cookies
        }
      });
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
