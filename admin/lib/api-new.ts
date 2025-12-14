import axios, { AxiosResponse } from 'axios';

// API URL для новой авторизации
const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Если запущено на localhost, используем полный URL к backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api';
    }
    // В production используем относительный путь (для работы через Nginx)
    return '/api';
  }

  // На сервере (SSR) используем localhost или переменную окружения
  return process.env?.API_URL || 'http://localhost:3001/api';
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
      // Обработка 401 ошибки
      if (error.response?.status === 401) {
        console.log('🔄 401 Error: Токен истек или недействителен, перенаправляем на логин');

        // Очищаем локальное состояние
        localStorage.removeItem('admin-token');
        sessionStorage.removeItem('admin-token');

        // Перенаправляем на страницу логина
        window.location.href = '/login';
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
