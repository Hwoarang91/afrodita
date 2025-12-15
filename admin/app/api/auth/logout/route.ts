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

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    
    // API_URL может уже содержать /api/v1, поэтому проверяем
    const backendUrl = API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`;
    const response = await fetch(`${backendUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    const nextResponse = NextResponse.json(
      { success: true },
      { status: response.ok ? 200 : response.status }
    );

    // Очищаем cookies - устанавливаем пустое значение с истекшим сроком
    // Используем те же опции, что и при установке, чтобы гарантировать удаление
    const isProduction = process.env.NODE_ENV === 'production';
    nextResponse.cookies.set('access_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    nextResponse.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    nextResponse.cookies.set('csrf_token', '', {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return nextResponse;
  } catch (error: any) {
    console.error('[Route Handler] Error logging out:', error);
    return NextResponse.json(
      { error: 'Internal server error during logout' },
      { status: 500 }
    );
  }
}

