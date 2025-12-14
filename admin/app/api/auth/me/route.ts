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
    const cookieStore = cookies();
    const cookieHeader = request.headers.get('cookie') || '';
    
    // API_URL может уже содержать /api/v1, поэтому проверяем
    const backendUrl = API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`;
    const response = await fetch(`${backendUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to get user info' }));
      return NextResponse.json(
        { error: errorData.message || 'Failed to get user info' },
        { status: response.status }
      );
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

