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
    const response = await fetch(`${backendUrl}/auth/logout-all`, {
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

    // Очищаем cookies
    nextResponse.cookies.delete('access_token');
    nextResponse.cookies.delete('refresh_token');
    nextResponse.cookies.delete('csrf_token');

    return nextResponse;
  } catch (error: any) {
    console.error('[Route Handler] Error logging out all devices:', error);
    return NextResponse.json(
      { error: 'Internal server error during logout all' },
      { status: 500 }
    );
  }
}

