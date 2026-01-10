import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type TelegramSessionStatus = 
  | 'none'           // Telegram не подключен
  | 'initializing'   // идет авторизация
  | 'waiting_2fa'    // ждем пароль 2FA (локальное состояние на frontend)
  | 'active'         // готово
  | 'expired'        // истекла
  | 'error';         // ошибка (локальное состояние на frontend)

export interface TelegramSessionStatusResponse {
  hasSession: boolean;
  status?: 'initializing' | 'active' | 'invalid' | 'revoked' | 'expired' | 'not_found';
  sessionId?: string | null;
  phoneNumber?: string | null;
  invalidReason?: string | null;
  createdAt?: number | null;
  lastUsedAt?: number | null;
}

/**
 * Преобразует backend статус в frontend UI статус
 */
export function mapBackendStatusToUI(backendStatus: TelegramSessionStatusResponse | null | undefined): TelegramSessionStatus {
  if (!backendStatus || !backendStatus.hasSession) {
    return 'none';
  }
  
  if (backendStatus.status === 'active') {
    return 'active';
  }
  
  if (backendStatus.status === 'initializing') {
    return 'initializing';
  }
  
  if (backendStatus.status === 'expired' || backendStatus.status === 'invalid' || backendStatus.status === 'revoked') {
    return 'expired';
  }
  
  return 'none';
}

/**
 * Hook для проверки статуса Telegram сессии с автоматическим polling
 * 
 * Возвращает UI-статус ('none', 'initializing', 'waiting_2fa', 'active', 'expired', 'error')
 * и raw backend response для получения дополнительных данных.
 * 
 * Polling работает так:
 * - Если сессии нет (hasSession=false) -> polling каждые 2 секунды
 * - Если статус initializing -> polling каждые 2 секунды до active
 * - Если статус active -> polling отключается
 * - Если статус expired/invalid/revoked -> polling отключается
 */
export function useTelegramSession() {
  const query = useQuery<TelegramSessionStatusResponse>({
    queryKey: ['telegram-session-status'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<TelegramSessionStatusResponse>('/telegram/user/session-status');
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

  // Преобразуем backend статус в UI статус
  const uiStatus = mapBackendStatusToUI(query.data);

  return {
    ...query,
    data: query.data,
    status: uiStatus, // UI-статус для использования в компонентах
  } as UseQueryResult<TelegramSessionStatusResponse> & { status: TelegramSessionStatus };
}

