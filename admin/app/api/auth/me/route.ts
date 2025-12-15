import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const getApiUrl = (): string => {
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL?.startsWith('http')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    return 'http://backend:3001';
  }
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

export async function GET(request: NextRequest) {
  try {
    // Получаем cookies через cookies() API - это работает для httpOnly cookies на сервере
    const cookieStore = await cookies();
    
    // Также пробуем получить из заголовка запроса (может содержать cookies, которые не видны через cookies() API)
    const requestCookieHeader = request.headers.get('cookie') || '';
    
    // Собираем все cookies в строку для передачи в backend
    const cookiePairs: string[] = [];
    
    // Сначала добавляем cookies из заголовка запроса (если есть)
    if (requestCookieHeader) {
      cookiePairs.push(requestCookieHeader);
    }
    
    // Затем добавляем cookies из cookies() API (если они не были в заголовке)
    cookieStore.getAll().forEach(cookie => {
      // Проверяем, не добавлен ли уже этот cookie из заголовка
      if (!requestCookieHeader.includes(`${cookie.name}=`)) {
        cookiePairs.push(`${cookie.name}=${cookie.value}`);
      }
    });
    
    const cookieHeader = cookiePairs.length > 0 ? cookiePairs.join('; ') : '';
    
    console.log('[Route Handler] Cookies для /auth/me:', {
      fromHeader: !!requestCookieHeader,
      fromStore: cookieStore.getAll().length,
      total: cookiePairs.length,
      hasAccessToken: cookieHeader.includes('access_token'),
    });
    
    // API_URL может уже содержать /api/v1, поэтому проверяем
    const backendUrl = API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`;
    const response = await fetch(`${backendUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { 'Cookie': cookieHeader }),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      // Если ответ не OK, пытаемся получить JSON, но если его нет - возвращаем общую ошибку
      let errorData;
      try {
        const text = await response.text();
        errorData = text ? JSON.parse(text) : { message: 'Failed to get user info' };
      } catch {
        errorData = { message: 'Failed to get user info' };
      }
      return NextResponse.json(
        { error: errorData.message || 'Failed to get user info' },
        { status: response.status }
      );
    }

    // Проверяем, есть ли контент в ответе
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      if (!text) {
        return NextResponse.json(
          { error: 'Empty response from server' },
          { status: 500 }
        );
      }
      try {
        return NextResponse.json(JSON.parse(text));
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from server' },
          { status: 500 }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Route Handler] Error getting user info:', error);
    return NextResponse.json(
      { error: 'Internal server error during user info retrieval' },
      { status: 500 }
    );
  }
}

