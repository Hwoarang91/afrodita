import axios from 'axios';

// API URL загружается из переменных окружения (корневой .env)
// Next.js автоматически подхватывает переменные с префиксом NEXT_PUBLIC_
// В продакшене используем относительный путь для работы через Nginx
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  (typeof window !== 'undefined' ? '/api/v1' : 'http://localhost:3001/api/v1');

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Логирование только в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log('API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        hasToken: !!token,
      });
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    // Логируем только в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log('API Response:', {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
  (error) => {
    const errorMessage = error?.response?.data?.message || error?.message || 'Произошла ошибка';
    const status = error.response?.status;
    
    // Логирование ошибок только в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        message: errorMessage,
        status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        data: error.response?.data,
      });
    }
    
    if (typeof window !== 'undefined') {
      // Обработка 401 - неавторизован
      if (status === 401) {
        localStorage.removeItem('admin-token');
        localStorage.removeItem('admin-user');
        // Удаляем токен из cookies
        document.cookie = 'admin-token=; path=/; max-age=0; SameSite=Lax';
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
      
      // Показываем toast для других ошибок (кроме 401, который уже обработан)
      if (status !== 401 && (window as any).showErrorToast) {
        let toastType: 'error' | 'warning' | 'info' = 'error';
        let message = errorMessage;
        
        if (status === 403) {
          toastType = 'warning';
          message = 'Доступ запрещен';
        } else if (status === 404) {
          toastType = 'info';
          message = 'Ресурс не найден';
        } else if (status === 500) {
          message = 'Ошибка сервера. Попробуйте позже';
        } else if (!error.response) {
          message = 'Ошибка сети. Проверьте подключение к интернету';
        }
        
        (window as any).showErrorToast(message, toastType);
      }
    }
    
    return Promise.reject(error);
  },
);

