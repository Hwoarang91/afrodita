import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

// API URL загружается из переменных окружения
// Vite автоматически подхватывает переменные с префиксом VITE_
// В продакшене используем относительный путь, чтобы nginx проксировал запросы
// В development можно использовать VITE_API_URL для указания полного URL
// ВАЖНО: в production НЕ должно быть VITE_API_URL, чтобы использовался относительный путь
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Логируем для отладки (только в development)
if (import.meta.env.DEV) {
  console.log('[API Client] API_URL:', API_URL);
  console.log('[API Client] VITE_API_URL:', import.meta.env.VITE_API_URL);
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Обработка сетевых ошибок (offline)
    if (!error.response && error.message === 'Network Error') {
      // Проверяем статус онлайн/оффлайн
      if (!navigator.onLine) {
        error.isOffline = true;
        error.message = 'Нет подключения к интернету. Проверьте ваше соединение.';
      }
    }

    // Обработка 401 - неавторизован
    if (error.response?.status === 401) {
      const { refreshToken, logout } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          useAuthStore.getState().setAuth(
            useAuthStore.getState().user!,
            accessToken,
            newRefreshToken,
          );
          error.config.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient.request(error.config);
        } catch {
          logout();
        }
      } else {
        logout();
      }
    }

    return Promise.reject(error);
  },
);

