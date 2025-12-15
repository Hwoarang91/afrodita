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
    // Используем заголовок cookie напрямую из запроса, если он есть
    // Это гарантирует правильную передачу всех cookies, включая httpOnly
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Если cookie header пустой, пытаемся получить через cookies() API
    let finalCookieHeader = cookieHeader;
    if (!cookieHeader) {
      const cookieStore = await cookies();
      const cookiePairs: string[] = [];
      cookieStore.getAll().forEach(cookie => {
        // Кодируем имя и значение cookie для безопасной передачи
        const encodedName = encodeURIComponent(cookie.name);
        const encodedValue = encodeURIComponent(cookie.value);
        cookiePairs.push(`${encodedName}=${encodedValue}`);
      });
      finalCookieHeader = cookiePairs.join('; ');
    }
    
    console.log('[Route Handler] Cookies для /auth/me:', finalCookieHeader ? 'есть' : 'нет');
    
    // API_URL может уже содержать /api/v1, поэтому проверяем
    const backendUrl = API_URL.endsWith('/api/v1') ? API_URL : `${API_URL}/api/v1`;
    const response = await fetch(`${backendUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(finalCookieHeader && { 'Cookie': finalCookieHeader }),
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

