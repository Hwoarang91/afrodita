import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional, forwardRef } from '@nestjs/common';
import {
  TelegramClientEventEmitter,
  TelegramClientConnectEvent,
  TelegramClientDisconnectEvent,
  TelegramClientErrorEvent,
  TelegramClientInvokeEvent,
  TelegramClientFloodWaitEvent,
} from './telegram-client-event-emitter.service';

/**
 * Унифицированный тип события для хранения в истории
 */
export interface TelegramEventLogEntry {
  id: string; // Уникальный ID события
  type: 'connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait';
  sessionId: string;
  userId?: string;
  timestamp: Date;
  data: {
    // Для connect
    phoneNumber?: string;
    // Для disconnect
    reason?: string;
    // Для error
    error?: string;
    errorStack?: string;
    context?: string;
    // Для invoke
    method?: string;
    duration?: number;
    // Для flood-wait
    waitTime?: number;
  };
}

/**
 * Параметры фильтрации для получения событий
 */
export interface EventLogFilter {
  eventTypes?: ('connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait')[];
  sessionIds?: string[];
  userIds?: string[];
  startTime?: Date;
  endTime?: Date;
  limit?: number; // Максимальное количество событий
}

/**
 * Сервис для логирования всех MTProto событий
 * Хранит последние N событий в памяти для истории
 */
@Injectable()
export class TelegramEventLoggerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramEventLoggerService.name);
  
  // История событий (кольцевой буфер)
  private eventHistory: TelegramEventLogEntry[] = [];
  private eventCounter = 0; // Счетчик для генерации уникальных ID
  
  // Максимальное количество событий в истории (по умолчанию 1000)
  private readonly maxHistorySize: number;
  
  constructor(
    @Optional() @Inject(forwardRef(() => TelegramClientEventEmitter))
    private readonly eventEmitter?: TelegramClientEventEmitter,
  ) {
    // Получаем размер истории из переменных окружения или используем значение по умолчанию
    const envSize = process.env.TELEGRAM_EVENT_LOG_HISTORY_SIZE;
    this.maxHistorySize = envSize ? Math.max(100, Math.min(10000, parseInt(envSize, 10))) : 1000;
    
    this.logger.log(
      `TelegramEventLoggerService initialized with maxHistorySize=${this.maxHistorySize}`,
    );
    
    if (!this.eventEmitter) {
      this.logger.warn('TelegramClientEventEmitter not available (optional)');
    }
  }

  onModuleInit() {
    // Подписываемся на все события TelegramClientEventEmitter
    if (this.eventEmitter) {
      this.eventEmitter.onConnect((event: TelegramClientConnectEvent) => {
        this.logEvent('connect', event.sessionId, event.userId, event.timestamp, {
          phoneNumber: event.phoneNumber,
        });
      });

      this.eventEmitter.onDisconnect((event: TelegramClientDisconnectEvent) => {
        this.logEvent('disconnect', event.sessionId, event.userId, event.timestamp, {
          reason: event.reason,
        });
      });

      this.eventEmitter.onError((event: TelegramClientErrorEvent) => {
        this.logEvent('error', event.sessionId, event.userId, event.timestamp, {
          error: event.error.message,
          errorStack: event.error.stack,
          context: event.context,
        });
      });

      this.eventEmitter.onInvoke((event: TelegramClientInvokeEvent) => {
        this.logEvent('invoke', event.sessionId, event.userId, event.timestamp, {
          method: event.method,
          duration: event.duration,
        });
      });

      this.eventEmitter.onFloodWait((event: TelegramClientFloodWaitEvent) => {
        this.logEvent('flood-wait', event.sessionId, event.userId, event.timestamp, {
          waitTime: event.waitTime,
          method: event.method,
        });
      });

      this.logger.log('Subscribed to all TelegramClientEventEmitter events');
    }
  }

  onModuleDestroy() {
    // Очищаем историю при остановке модуля
    this.eventHistory = [];
    this.eventCounter = 0;
    this.logger.log('TelegramEventLoggerService destroyed, history cleared');
  }

  /**
   * Логирование события в историю
   */
  private logEvent(
    type: 'connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait',
    sessionId: string,
    userId: string | undefined,
    timestamp: Date,
    data: TelegramEventLogEntry['data'],
  ): void {
    const entry: TelegramEventLogEntry = {
      id: `event-${++this.eventCounter}-${Date.now()}`,
      type,
      sessionId,
      userId,
      timestamp,
      data,
    };

    // Добавляем событие в историю
    this.eventHistory.push(entry);

    // Если превышен лимит, удаляем самое старое событие
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift(); // Удаляем первое (самое старое) событие
    }

    this.logger.debug(
      `Logged event: type=${type}, sessionId=${sessionId}, historySize=${this.eventHistory.length}`,
    );
  }

  /**
   * Получение истории событий с фильтрацией
   * @param filter Параметры фильтрации
   * @returns Массив событий, отсортированных по времени (новые первыми)
   */
  getEventHistory(filter?: EventLogFilter): TelegramEventLogEntry[] {
    let filtered = [...this.eventHistory];

    // Фильтрация по типу события
    if (filter?.eventTypes && filter.eventTypes.length > 0) {
      filtered = filtered.filter((entry) => filter.eventTypes!.includes(entry.type));
    }

    // Фильтрация по sessionId
    if (filter?.sessionIds && filter.sessionIds.length > 0) {
      filtered = filtered.filter((entry) => filter.sessionIds!.includes(entry.sessionId));
    }

    // Фильтрация по userId
    if (filter?.userIds && filter.userIds.length > 0) {
      filtered = filtered.filter((entry) => entry.userId && filter.userIds!.includes(entry.userId));
    }

    // Фильтрация по времени начала
    if (filter?.startTime) {
      filtered = filtered.filter((entry) => entry.timestamp >= filter.startTime!);
    }

    // Фильтрация по времени окончания
    if (filter?.endTime) {
      filtered = filtered.filter((entry) => entry.timestamp <= filter.endTime!);
    }

    // Сортировка по времени (новые первыми)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Ограничение количества результатов
    if (filter?.limit && filter.limit > 0) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Получение последних N событий
   * @param limit Количество событий (по умолчанию 100)
   * @returns Массив последних событий
   */
  getRecentEvents(limit: number = 100): TelegramEventLogEntry[] {
    return this.getEventHistory({ limit });
  }

  /**
   * Получение событий по типу
   * @param eventType Тип события
   * @param limit Количество событий
   * @returns Массив событий указанного типа
   */
  getEventsByType(
    eventType: 'connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait',
    limit?: number,
  ): TelegramEventLogEntry[] {
    return this.getEventHistory({ eventTypes: [eventType], limit });
  }

  /**
   * Получение событий по sessionId
   * @param sessionId ID сессии
   * @param limit Количество событий
   * @returns Массив событий для указанной сессии
   */
  getEventsBySessionId(sessionId: string, limit?: number): TelegramEventLogEntry[] {
    return this.getEventHistory({ sessionIds: [sessionId], limit });
  }

  /**
   * Получение событий по userId
   * @param userId ID пользователя
   * @param limit Количество событий
   * @returns Массив событий для указанного пользователя
   */
  getEventsByUserId(userId: string, limit?: number): TelegramEventLogEntry[] {
    return this.getEventHistory({ userIds: [userId], limit });
  }

  /**
   * Получение статистики по событиям
   * @returns Статистика по типам событий
   */
  getEventStatistics(): {
    total: number;
    byType: Record<string, number>;
    bySession: Record<string, number>;
    oldestEvent?: Date;
    newestEvent?: Date;
  } {
    const stats = {
      total: this.eventHistory.length,
      byType: {} as Record<string, number>,
      bySession: {} as Record<string, number>,
      oldestEvent: undefined as Date | undefined,
      newestEvent: undefined as Date | undefined,
    };

    if (this.eventHistory.length === 0) {
      return stats;
    }

    // Подсчет по типам
    for (const entry of this.eventHistory) {
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
      stats.bySession[entry.sessionId] = (stats.bySession[entry.sessionId] || 0) + 1;
    }

    // Определение самого старого и нового события
    const timestamps = this.eventHistory.map((e) => e.timestamp.getTime());
    stats.oldestEvent = new Date(Math.min(...timestamps));
    stats.newestEvent = new Date(Math.max(...timestamps));

    return stats;
  }

  /**
   * Очистка истории событий
   */
  clearHistory(): void {
    const count = this.eventHistory.length;
    this.eventHistory = [];
    this.logger.log(`Event history cleared (${count} events removed)`);
  }

  /**
   * Получение размера истории
   */
  getHistorySize(): number {
    return this.eventHistory.length;
  }

  /**
   * Получение максимального размера истории
   */
  getMaxHistorySize(): number {
    return this.maxHistorySize;
  }
}
