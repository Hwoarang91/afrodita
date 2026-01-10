import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface TelegramSessionStatus {
  hasSession: boolean;
  status: 'active' | 'initializing' | 'expired' | 'error' | 'not_found';
  sessionId: string | null;
  createdAt: number | null;
}

/**
 * Hook для проверки статуса Telegram сессии с автоматическим polling
 * 
 * Polling работает так:
 * - Если сессии нет (not_found) -> polling каждые 2 секунды
 * - Если статус initializing -> polling каждые 2 секунды до active
 * - Если статус active -> polling отключается
 * - Если статус expired/error -> polling отключается
 */
export function useTelegramSession() {
  return useQuery<TelegramSessionStatus>({
    queryKey: ['telegram-session-status'],
    queryFn: async () => {
      const response = await apiClient.get<TelegramSessionStatus>('/telegram/user/status');
      return response.data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      
      // Если данных еще нет, проверяем сразу
      if (!data) {
        return 2000;
      }
      
      // Если статус active, отключаем polling
      if (data.status === 'active') {
        return false;
      }
      
      // Если статус expired или error, отключаем polling
      if (data.status === 'expired' || data.status === 'error') {
        return false;
      }
      
      // Для not_found и initializing продолжаем polling каждые 2 секунды
      return 2000;
    },
    retry: false, // Не ретраим при ошибках - просто возвращаем данные
    staleTime: 0, // Всегда считаем данные устаревшими для polling
  });
}

