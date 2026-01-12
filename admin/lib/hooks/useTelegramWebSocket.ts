'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Получаем WebSocket URL на основе API URL
const getWebSocketUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Если запущено на localhost, используем полный URL к backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    // В production используем текущий хост
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

export interface TelegramEventLog {
  type: 'connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait';
  sessionId: string;
  userId?: string;
  timestamp: string;
  data: {
    phoneNumber?: string;
    reason?: string;
    error?: string;
    errorStack?: string;
    context?: string;
    method?: string;
    duration?: number;
    waitTime?: number;
  };
}

export interface TelegramConnectionStatus {
  sessionId: string;
  status: 'connected' | 'disconnected' | 'error' | 'heartbeat';
  userId?: string;
  phoneNumber?: string;
  reason?: string;
  error?: string;
  context?: string;
  isConnected?: boolean;
  lastCheck?: string;
  timestamp: string;
}

interface UseTelegramWebSocketOptions {
  enabled?: boolean;
  sessionId?: string;
  eventTypes?: ('connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait')[];
  onEventLog?: (event: TelegramEventLog) => void;
  onConnectionStatus?: (status: TelegramConnectionStatus) => void;
}

/**
 * Hook для подключения к WebSocket и подписки на Telegram события
 */
export function useTelegramWebSocket(options: UseTelegramWebSocketOptions = {}) {
  const {
    enabled = true,
    sessionId,
    eventTypes,
    onEventLog,
    onConnectionStatus,
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Инициализация WebSocket подключения
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const wsUrl = getWebSocketUrl();
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Обработка подключения
    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('[WebSocket] Connected to server');

      // Подписываемся на event log с фильтрами
      if (eventTypes || sessionId) {
        newSocket.emit('subscribe-telegram-event-log', {
          eventTypes,
          sessionIds: sessionId ? [sessionId] : undefined,
        });
      }

      // Подписываемся на статус соединения, если указан sessionId
      if (sessionId) {
        newSocket.emit('subscribe-telegram-status', { sessionId });
      }
    });

    // Обработка отключения
    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[WebSocket] Disconnected:', reason);
    });

    // Обработка ошибок подключения
    newSocket.on('connect_error', (err) => {
      setError(err.message);
      console.error('[WebSocket] Connection error:', err);
    });

    // Подписка на event log
    newSocket.on('telegram-event-log', (event: TelegramEventLog) => {
      if (onEventLog) {
        onEventLog(event);
      }
    });

    // Подписка на статус соединения
    newSocket.on('telegram-connection-status', (status: TelegramConnectionStatus) => {
      if (onConnectionStatus) {
        onConnectionStatus(status);
      }
    });

    // Подтверждения подписок
    newSocket.on('telegram-event-log-subscribed', () => {
      console.log('[WebSocket] Subscribed to event log');
    });

    newSocket.on('telegram-status-subscribed', (data: { sessionId: string }) => {
      console.log('[WebSocket] Subscribed to connection status:', data.sessionId);
    });

    // Очистка при размонтировании
    return () => {
      if (newSocket) {
        // Отписываемся от event log
        newSocket.emit('unsubscribe-telegram-event-log');
        
        // Отписываемся от статуса соединения
        if (sessionId) {
          newSocket.emit('unsubscribe-telegram-status', { sessionId });
        }
        
        newSocket.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [enabled, sessionId, eventTypes, onEventLog, onConnectionStatus]);

  // Функция для переподписки на event log
  const subscribeToEventLog = useCallback(
    (filters: { eventTypes?: string[]; sessionIds?: string[] }) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit('subscribe-telegram-event-log', filters);
      }
    },
    [isConnected],
  );

  // Функция для отписки от event log
  const unsubscribeFromEventLog = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('unsubscribe-telegram-event-log');
    }
  }, [isConnected]);

  return {
    socket,
    isConnected,
    error,
    subscribeToEventLog,
    unsubscribeFromEventLog,
  };
}
