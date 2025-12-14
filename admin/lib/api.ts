import axios, { AxiosResponse } from 'axios';

// API URL для новой авторизации
const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Если запущено на localhost, используем полный URL к backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api/v1';
    }
    // В production используем относительный путь (для работы через Nginx)
    return '/api/v1';
  }

  // На сервере (SSR) используем localhost или переменную окружения
  return process.env?.API_URL || 'http://localhost:3001/api/v1';
};

// Создаем API клиент для работы с httpOnly cookies
export const apiClient = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Важно для отправки cookies
});

// Request interceptor для CSRF защиты
apiClient.interceptors.request.use((config) => {
  // Добавляем CSRF токен к запросам, требующим защиты
  if (typeof window !== 'undefined' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf_token='))
      ?.split('=')[1];

    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

// Response interceptor для обработки ошибок авторизации
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    if (typeof window !== 'undefined') {
      // Обработка 401 ошибки - пытаемся обновить токены через refresh
      if (error.response?.status === 401) {
        const originalRequest = error.config;
        
        // Проверяем, не является ли это запросом на refresh (чтобы избежать бесконечного цикла)
        if (originalRequest?.url?.includes('/auth/refresh') || originalRequest?._retry) {
          console.log('🔄 Refresh token истек, перенаправляем на логин');
          // Очищаем локальное состояние
          localStorage.removeItem('admin-token');
          sessionStorage.removeItem('admin-token');
          sessionStorage.removeItem('autoLogin');
          // Перенаправляем на страницу логина
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Пытаемся обновить токены через refresh
        try {
          console.log('🔄 401 Error: Пытаемся обновить токены через refresh');
          
          // Получаем CSRF токен
          const csrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrf_token='))
            ?.split('=')[1] || '';

          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({ refreshToken: '' }), // Route handler получит из cookies
          });

          if (refreshResponse.ok) {
            console.log('✅ Токены успешно обновлены, повторяем оригинальный запрос');
            // Помечаем запрос как повторный, чтобы избежать бесконечного цикла
            originalRequest._retry = true;
            // Повторяем оригинальный запрос с обновленными токенами
            return apiClient(originalRequest);
          } else {
            throw new Error('Refresh failed');
          }
        } catch (refreshError) {
          console.log('❌ Не удалось обновить токены, перенаправляем на логин');
          // Очищаем локальное состояние
          localStorage.removeItem('admin-token');
          sessionStorage.removeItem('admin-token');
          sessionStorage.removeItem('autoLogin');
          // Перенаправляем на страницу логина
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }

      // Обработка сетевых ошибок
      if (!error.response) {
        console.error('🌐 Network Error:', error.message);
        // Можно показать toast с ошибкой сети
      }
    }

    return Promise.reject(error);
  },
);

// Типы для API ответов
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  statusCode?: number;
}

// Вспомогательные функции для API запросов
export const api = {
  get: <T = any>(url: string) => apiClient.get<ApiResponse<T>>(url).then(res => res.data),
  post: <T = any>(url: string, data?: any) => apiClient.post<ApiResponse<T>>(url, data).then(res => res.data),
  put: <T = any>(url: string, data?: any) => apiClient.put<ApiResponse<T>>(url, data).then(res => res.data),
  patch: <T = any>(url: string, data?: any) => apiClient.patch<ApiResponse<T>>(url, data).then(res => res.data),
  delete: <T = any>(url: string) => apiClient.delete<ApiResponse<T>>(url).then(res => res.data),
};
