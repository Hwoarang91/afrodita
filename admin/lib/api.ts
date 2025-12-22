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

  // КРИТИЧНО: Удаляем userId из запросов к /auth/telegram/2fa/verify
  // Это поле не должно быть в DTO из-за forbidNonWhitelisted: true
  const url = config.url || '';
  const fullUrl = url.includes('/auth/telegram/2fa/verify') || 
                  config.baseURL?.includes('/auth/telegram/2fa/verify') ||
                  (config.baseURL + url).includes('/auth/telegram/2fa/verify');
  
  if (fullUrl && config.data) {
    // Обрабатываем как объект (самый частый случай)
    if (typeof config.data === 'object' && config.data !== null && !Array.isArray(config.data) && !(config.data instanceof FormData)) {
      if ('userId' in config.data) {
        const { userId, ...restData } = config.data;
        if (process.env.NODE_ENV === 'development') {
          console.warn('[API Interceptor] Removed userId from 2FA verify request:', userId);
        }
        config.data = restData;
      }
    }
    // Обрабатываем как строку (JSON)
    else if (typeof config.data === 'string') {
      try {
        const parsed = JSON.parse(config.data);
        if (parsed && typeof parsed === 'object' && parsed !== null && 'userId' in parsed) {
          const { userId, ...restData } = parsed;
          if (process.env.NODE_ENV === 'development') {
            console.warn('[API Interceptor] Removed userId from 2FA verify request (JSON string):', userId);
          }
          config.data = JSON.stringify(restData);
        }
      } catch (e) {
        // Не JSON, пропускаем
      }
    }
  }

  return config;
});

// Флаг для отслеживания попытки обновления токена
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (reason?: any) => void }> = [];

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
          // Очищаем локальное состояние
          localStorage.removeItem('admin-token');
          sessionStorage.removeItem('admin-token');
          sessionStorage.removeItem('autoLogin');
          // Перенаправляем на страницу логина только если не на публичной странице
          const pathname = window.location.pathname;
          const isPublicPage = pathname.includes('/login') || pathname.includes('/register');
          if (!isPublicPage) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }

        // Для Telegram эндпоинтов не делаем редирект на логин при 401
        // Это может быть связано с отсутствием Telegram сессии, а не с проблемой авторизации
        if (originalRequest?.url?.includes('/telegram/user/') || 
            originalRequest?.url?.includes('/auth/telegram/') ||
            originalRequest?.url?.includes('/telegram/2fa/') ||
            originalRequest?.url?.includes('/auth/telegram/2fa/')) {
          // Просто возвращаем ошибку без редиректа
          return Promise.reject(error);
        }

        // Если уже идет обновление токена, добавляем запрос в очередь
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              return apiClient(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        // Пытаемся обновить токены через refresh
        isRefreshing = true;
        try {
          // Получаем CSRF токен
          const csrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrf_token='))
            ?.split('=')[1] || '';

          // Используем правильный URL с учетом baseURL
          const refreshUrl = `${getApiUrl()}/auth/refresh`;
          const refreshResponse = await fetch(refreshUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({ refreshToken: '' }), // Route handler получит из cookies
          });

          if (refreshResponse.ok) {
            // Помечаем запрос как повторный, чтобы избежать бесконечного цикла
            originalRequest._retry = true;
            
            // Обрабатываем очередь ожидающих запросов
            failedQueue.forEach(({ resolve }) => resolve());
            failedQueue = [];
            isRefreshing = false;
            
            // Повторяем оригинальный запрос с обновленными токенами
            return apiClient(originalRequest);
          } else {
            // Если refresh token истек или недействителен, получаем детали ошибки
            const errorData = await refreshResponse.json().catch(() => ({ 
              message: 'Refresh token expired or invalid' 
            }));
            throw new Error(errorData.message || errorData.error || 'Refresh failed');
          }
        } catch (refreshError) {
          // Обрабатываем очередь ожидающих запросов с ошибкой
          failedQueue.forEach(({ reject }) => reject(refreshError));
          failedQueue = [];
          isRefreshing = false;
          
          // Для Telegram эндпоинтов не делаем редирект на логин при ошибках
          if (originalRequest?.url?.includes('/auth/telegram/') || 
              originalRequest?.url?.includes('/telegram/user/') ||
              originalRequest?.url?.includes('/telegram/2fa/')) {
            return Promise.reject(error);
          }
          
          // Логируем ошибку для отладки
          console.error('Token refresh failed:', refreshError);
          
          // Очищаем локальное состояние
          localStorage.removeItem('admin-token');
          sessionStorage.removeItem('admin-token');
          sessionStorage.removeItem('autoLogin');
          
          // Перенаправляем на страницу логина только если не на публичной странице
          const pathname = window.location.pathname;
          const isPublicPage = pathname.includes('/login') || pathname.includes('/register');
          if (!isPublicPage) {
            // Небольшая задержка перед редиректом, чтобы избежать множественных редиректов
            setTimeout(() => {
              window.location.href = '/login';
            }, 100);
          }
          return Promise.reject(error);
        }
      }

      // Обработка других ошибок (не 401)
      // Для Telegram эндпоинтов не делаем редирект при любых ошибках
      if (error.config?.url?.includes('/auth/telegram/')) {
        // Просто возвращаем ошибку без редиректа
        return Promise.reject(error);
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
