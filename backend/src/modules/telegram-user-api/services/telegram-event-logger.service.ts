import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional, forwardRef } from '@nestjs/common';
import {
  TelegramClientEventEmitter,
  TelegramClientConnectEvent,
  TelegramClientDisconnectEvent,
  TelegramClientErrorEvent,
  TelegramClientInvokeEvent,
  TelegramClientFloodWaitEvent,
} from './telegram-client-event-emitter.service';

export interface TelegramEventLogEntry {
  id: string;
  type: 'connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait';
  sessionId: string;
  userId?: string;
  timestamp: Date;
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

export interface EventLogFilter {
  eventTypes?: ('connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait')[];
  sessionIds?: string[];
  userIds?: string[];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

@Injectable()
export class TelegramEventLoggerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramEventLoggerService.name);
  private eventHistory: TelegramEventLogEntry[] = [];
  private eventCounter = 0;
  private readonly maxHistorySize: number;

  constructor(
    @Optional() @Inject(forwardRef(() => TelegramClientEventEmitter))
    private readonly eventEmitter?: TelegramClientEventEmitter,
  ) {
    const envSize = process.env.TELEGRAM_EVENT_LOG_HISTORY_SIZE;
    this.maxHistorySize = envSize ? Math.max(100, Math.min(10000, parseInt(envSize, 10))) : 1000;
    this.logger.log(`TelegramEventLoggerService (User API) initialized, maxHistorySize=${this.maxHistorySize}`);
  }

  onModuleInit() {
    if (this.eventEmitter) {
      this.eventEmitter.onConnect((event: TelegramClientConnectEvent) => {
        this.logEvent('connect', event.sessionId, event.userId, event.timestamp, {
          phoneNumber: event.phoneNumber,
        });
      });
      this.eventEmitter.onDisconnect((event: TelegramClientDisconnectEvent) => {
        this.logEvent('disconnect', event.sessionId, event.userId, event.timestamp, { reason: event.reason });
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
    this.eventHistory = [];
    this.eventCounter = 0;
    this.logger.log('TelegramEventLoggerService destroyed');
  }

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
    this.eventHistory.push(entry);
    if (this.eventHistory.length > this.maxHistorySize) this.eventHistory.shift();
  }

  getEventHistory(filter?: EventLogFilter): TelegramEventLogEntry[] {
    let filtered = [...this.eventHistory];
    if (filter?.eventTypes?.length) filtered = filtered.filter((e) => filter.eventTypes!.includes(e.type));
    if (filter?.sessionIds?.length) filtered = filtered.filter((e) => filter.sessionIds!.includes(e.sessionId));
    if (filter?.userIds?.length) filtered = filtered.filter((e) => e.userId && filter.userIds!.includes(e.userId));
    if (filter?.startTime) filtered = filtered.filter((e) => e.timestamp >= filter.startTime!);
    if (filter?.endTime) filtered = filtered.filter((e) => e.timestamp <= filter.endTime!);
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    if (filter?.limit && filter.limit > 0) filtered = filtered.slice(0, filter.limit);
    return filtered;
  }

  getRecentEvents(limit = 100): TelegramEventLogEntry[] {
    return this.getEventHistory({ limit });
  }

  getEventsByType(
    eventType: 'connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait',
    limit?: number,
  ): TelegramEventLogEntry[] {
    return this.getEventHistory({ eventTypes: [eventType], limit });
  }

  getEventsBySessionId(sessionId: string, limit?: number): TelegramEventLogEntry[] {
    return this.getEventHistory({ sessionIds: [sessionId], limit });
  }

  getEventsByUserId(userId: string, limit?: number): TelegramEventLogEntry[] {
    return this.getEventHistory({ userIds: [userId], limit });
  }

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
    if (this.eventHistory.length === 0) return stats;
    for (const e of this.eventHistory) {
      stats.byType[e.type] = (stats.byType[e.type] || 0) + 1;
      stats.bySession[e.sessionId] = (stats.bySession[e.sessionId] || 0) + 1;
    }
    const ts = this.eventHistory.map((e) => e.timestamp.getTime());
    stats.oldestEvent = new Date(Math.min(...ts));
    stats.newestEvent = new Date(Math.max(...ts));
    return stats;
  }

  clearHistory(): void {
    const n = this.eventHistory.length;
    this.eventHistory = [];
    this.logger.log(`Event history cleared (${n} events removed)`);
  }

  getHistorySize(): number {
    return this.eventHistory.length;
  }

  getMaxHistorySize(): number {
    return this.maxHistorySize;
  }
}
