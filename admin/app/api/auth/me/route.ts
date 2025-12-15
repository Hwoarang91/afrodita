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
    const allCookies = cookieStore.getAll();
    
    // Также пробуем получить из заголовка запроса (может содержать cookies, которые не видны через cookies() API)
    const requestCookieHeader = request.headers.get('cookie') || '';
    
    // Используем cookies из cookieStore (они должны содержать httpOnly cookies)
    // Если их нет, используем из заголовка
    let cookieHeader = '';
    
    if (allCookies.length > 0) {
      // Собираем cookies из cookieStore
      const cookiePairs = allCookies.map(cookie => `${cookie.name}=${cookie.value}`);
      cookieHeader = cookiePairs.join('; ');
    } else if (requestCookieHeader) {
      // Fallback на заголовок, если cookieStore пуст
      cookieHeader = requestCookieHeader;
    }
    
    // Если нет access_token, но есть refresh_token, пытаемся обновить токены
    if (!cookieHeader.includes('access_token') && cookieHeader.includes('refresh_token')) {
      
      const backendUrl = API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`;
      const refreshResponse = await fetch(`${backendUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader && { 'Cookie': cookieHeader }),
        },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: '' }), // Backend получит из cookies
      });
      
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        // Обновляем cookies из ответа refresh через cookies.set(), как в refresh/route.ts
        const setCookieHeaders = refreshResponse.headers.getSetCookie();
        const nextResponse = NextResponse.json(refreshData);
        
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
              options.sameSite = trimmed.split('=')[1]?.toLowerCase() || 'lax';
            } else if (trimmed.toLowerCase().startsWith('path')) {
              options.path = trimmed.split('=')[1] || '/';
            } else if (trimmed.toLowerCase().startsWith('max-age')) {
              options.maxAge = parseInt(trimmed.split('=')[1] || '0', 10);
            }
          });
          
          nextResponse.cookies.set(name, value, options);
        });
        
        // Теперь повторяем запрос /auth/me с обновленными cookies
        // Используем cookies из cookieStore после обновления
        const updatedCookieStore = await cookies();
        const updatedCookies = updatedCookieStore.getAll();
        const updatedCookieHeader = updatedCookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        const meResponse = await fetch(`${backendUrl}/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(updatedCookieHeader && { 'Cookie': updatedCookieHeader }),
          },
          credentials: 'include',
        });
        
        if (meResponse.ok) {
          const meData = await meResponse.json();
          // Обновляем cookies из ответа me (если есть)
          const meSetCookieHeaders = meResponse.headers.getSetCookie();
          meSetCookieHeaders.forEach(cookie => {
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
          });
          return nextResponse;
        }
      }
    }
    
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

