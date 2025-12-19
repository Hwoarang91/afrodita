import { NextRequest, NextResponse } from 'next/server';

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
    // API_URL может уже содержать /api/v1, поэтому проверяем
    let backendUrl = API_URL;
    if (!backendUrl.endsWith('/api/v1')) {
      // Если API_URL не заканчивается на /api/v1, добавляем его
      backendUrl = backendUrl.endsWith('/') ? `${backendUrl}api/v1` : `${backendUrl}/api/v1`;
    }
    // Убираем /api/v1 из конца, если он есть, чтобы добавить /auth/csrf-token
    const baseUrl = backendUrl.replace(/\/api\/v1$/, '');
    const response = await fetch(`${baseUrl}/api/v1/auth/csrf-token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to get CSRF token' }));
      return NextResponse.json(
        { error: errorData.message || 'Failed to get CSRF token' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Копируем cookies из ответа backend
    const setCookieHeaders = response.headers.getSetCookie();
    const responseHeaders = new Headers();
    
    setCookieHeaders.forEach(cookie => {
      responseHeaders.append('Set-Cookie', cookie);
    });

    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error: any) {
    console.error('[Route Handler] Error getting CSRF token:', error);
    return NextResponse.json(
      { error: 'Internal server error during CSRF token retrieval' },
      { status: 500 }
    );
  }
}

