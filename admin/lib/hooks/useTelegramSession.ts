import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface TelegramSessionStatus {
  hasSession: boolean;
  status?: 'initializing' | 'active' | 'invalid' | 'revoked' | 'expired' | 'not_found';
  sessionId?: string | null;
  phoneNumber?: string | null;
  invalidReason?: string | null;
  createdAt?: number | null;
  lastUsedAt?: number | null;
}

/**
 * Hook для проверки статуса Telegram сессии с автоматическим polling
 * 
 * Polling работает так:
 * - Если сессии нет (not_found или hasSession=false) -> polling каждые 2 секунды
 * - Если статус initializing -> polling каждые 2 секунды до active
 * - Если статус active -> polling отключается
 * - Если статус expired/invalid/revoked -> polling отключается
 */
export function useTelegramSession() {
  return useQuery<TelegramSessionStatus>({
    queryKey: ['telegram-session-status'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<TelegramSessionStatus>('/telegram/user/session-status');
        return response.data;
      } catch (error: any) {
        // Если 401 - пользователь не авторизован в дашборде
        if (error.response?.status === 401) {
          throw new Error('Not authenticated');
        }
        // Для других ошибок возвращаем пустой статус
        return {
          hasSession: false,
        };
      }
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      
      // Если данных еще нет, проверяем сразу
      if (!data) {
        return 2000;
      }
      
      // Если нет сессии, продолжаем polling (может появиться)
      if (!data.hasSession) {
        return 2000;
      }
      
      // Если статус active, отключаем polling
      if (data.status === 'active') {
        return false;
      }
      
      // Если статус expired/invalid/revoked, отключаем polling
      if (data.status === 'expired' || data.status === 'invalid' || data.status === 'revoked') {
        return false;
      }
      
      // Для initializing продолжаем polling каждые 2 секунды
      if (data.status === 'initializing') {
        return 2000;
      }
      
      // По умолчанию не polling
      return false;
    },
    retry: false, // Не ретраим при ошибках
    staleTime: 5000, // Кеш на 5 секунд
  });
}

