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

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_URL}/v1/auth/check-setup`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to check setup' }));
      return NextResponse.json(
        { error: errorData.message || 'Failed to check setup' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Route Handler] Error checking setup:', error);
    return NextResponse.json(
      { error: 'Internal server error during setup check' },
      { status: 500 }
    );
  }
}

