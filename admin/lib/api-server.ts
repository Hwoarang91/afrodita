import { cookies } from 'next/headers';

// Server-side API client для использования в Server Components
// Использует cookies для аутентификации вместо localStorage

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'http://localhost:3001/api/v1';

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
  } catch (error: any) {
    // Если ошибка сети или другие - пробрасываем дальше
    throw error;
  }
}

