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
    // API_URL уже содержит /api/v1 (из env: http://backend:3001/api/v1)
    // Просто добавляем путь к endpoint
    const backendUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const response = await fetch(`${backendUrl}/auth/csrf-token`, {
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

