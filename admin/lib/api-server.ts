import { cookies } from 'next/headers';

// Server-side API client для использования в Server Components
// Использует cookies для аутентификации вместо localStorage

// Для серверных запросов (Server Components) используем полный URL к backend
// NEXT_PUBLIC_API_URL используется только для клиентских запросов
// API_URL используется для серверных запросов (внутри Docker сети)
const getApiUrl = (): string => {
  // Если есть API_URL (для серверных запросов), используем его
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  
  // Если NEXT_PUBLIC_API_URL - это полный URL (начинается с http), используем его
  if (process.env.NEXT_PUBLIC_API_URL?.startsWith('http')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // В production внутри Docker используем внутренний URL к backend
  if (process.env.NODE_ENV === 'production') {
    return 'http://backend:3001/api/v1';
  }

  // В development используем localhost
  return 'http://localhost:3001/api/v1';
};

const API_URL = getApiUrl();

export async function fetchFromAPI<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-token')?.value;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      cache: 'no-store', // Всегда получаем свежие данные
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Неавторизован - редирект будет обработан на клиенте
        throw new Error('Unauthorized');
      }
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || data; // Возвращаем data если есть, иначе весь объект
  } catch (error: unknown) {
    // Если ошибка сети или другие - пробрасываем дальше
    throw error;
  }
}

