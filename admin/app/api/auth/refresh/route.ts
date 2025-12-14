import { NextRequest, NextResponse } from 'next/server';

const getApiUrl = (): string => {
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  
  if (process.env.NEXT_PUBLIC_API_URL?.startsWith('http')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  if (process.env.NODE_ENV === 'production') {
    return 'http://backend:3001/api';
  }

  return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[Route Handler] Попытка refresh токенов');

    // Вызываем backend API для refresh
    // Backend должен получить refresh token из cookies (он httpOnly)
    // Передаем все cookies из запроса
    const cookieHeader = request.headers.get('cookie') || '';
    
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader, // Передаем все cookies включая httpOnly refresh_token
      },
      body: JSON.stringify({ refreshToken: body.refreshToken || '' }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'Ошибка при обновлении токенов',
      }));
      return NextResponse.json(
        { error: errorData.message || 'Ошибка при обновлении токенов' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Создаем ответ с обновленными cookies
    const nextResponse = NextResponse.json({
      success: true,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });

    // Копируем cookies из ответа backend
    const setCookieHeaders = response.headers.getSetCookie();
    setCookieHeaders.forEach(cookie => {
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
          options.sameSite = trimmed.split('=')[1]?.toLowerCase() || 'strict';
        } else if (trimmed.toLowerCase().startsWith('path')) {
          options.path = trimmed.split('=')[1] || '/';
        } else if (trimmed.toLowerCase().startsWith('max-age')) {
          options.maxAge = parseInt(trimmed.split('=')[1] || '0', 10);
        }
      });

      nextResponse.cookies.set(name, value, options);
    });

    console.log('[Route Handler] Токены успешно обновлены');
    return nextResponse;

  } catch (error: any) {
    console.error('[Route Handler] Ошибка при обновлении токенов:', error);
    return NextResponse.json(
      { error: error.message || 'Ошибка при обновлении токенов' },
      { status: 500 }
    );
  }
}

