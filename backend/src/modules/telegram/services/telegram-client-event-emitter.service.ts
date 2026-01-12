import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface TelegramClientConnectEvent {
  sessionId: string;
  userId: string;
  phoneNumber?: string;
  timestamp: Date;
}

export interface TelegramClientDisconnectEvent {
  sessionId: string;
  userId: string;
  reason?: string;
  timestamp: Date;
}

export interface TelegramClientErrorEvent {
  sessionId: string;
  userId?: string;
  error: Error;
  context?: string;
  timestamp: Date;
}

export interface TelegramClientInvokeEvent {
  sessionId: string;
  userId?: string;
  method: string;
  timestamp: Date;
  duration?: number; // В миллисекундах
}

export interface TelegramClientFloodWaitEvent {
  sessionId: string;
  userId?: string;
  waitTime: number; // В секундах
  method?: string;
  timestamp: Date;
}

/**
 * EventEmitter для событий MTProto клиентов
 * Используется для отслеживания состояний клиентов и событий
 */
@Injectable()
export class TelegramClientEventEmitter extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(TelegramClientEventEmitter.name);

  constructor() {
    super();
    // Увеличиваем лимит слушателей для поддержки множества подписчиков
    this.setMaxListeners(50);
    this.logger.log('TelegramClientEventEmitter initialized');
  }

  /**
   * Эмитит событие подключения клиента
   */
  emitConnect(sessionId: string, userId: string, phoneNumber?: string): void {
    const event: TelegramClientConnectEvent = {
      sessionId,
      userId,
      phoneNumber,
      timestamp: new Date(),
    };
    this.emit('connect', event);
    this.logger.debug(`Client connected: sessionId=${sessionId}, userId=${userId}`);
  }

  /**
   * Эмитит событие отключения клиента
   */
  emitDisconnect(sessionId: string, userId: string, reason?: string): void {
    const event: TelegramClientDisconnectEvent = {
      sessionId,
      userId,
      reason,
      timestamp: new Date(),
    };
    this.emit('disconnect', event);
    this.logger.debug(`Client disconnected: sessionId=${sessionId}, reason=${reason || 'unknown'}`);
  }

  /**
   * Эмитит событие ошибки клиента
   */
  emitError(sessionId: string, error: Error, userId?: string, context?: string): void {
    const event: TelegramClientErrorEvent = {
      sessionId,
      userId,
      error,
      context,
      timestamp: new Date(),
    };
    this.emit('error', event);
    this.logger.warn(
      `Client error: sessionId=${sessionId}, error=${error.message}, context=${context || 'unknown'}`,
    );
  }

  /**
   * Эмитит событие выполнения invoke запроса
   */
  emitInvoke(sessionId: string, method: string, userId?: string, duration?: number): void {
    const event: TelegramClientInvokeEvent = {
      sessionId,
      userId,
      method,
      duration,
      timestamp: new Date(),
    };
    this.emit('invoke', event);
    if (duration) {
      this.logger.debug(
        `Invoke completed: sessionId=${sessionId}, method=${method}, duration=${duration}ms`,
      );
    }
  }

  /**
   * Эмитит событие FloodWait
   */
  emitFloodWait(sessionId: string, waitTime: number, userId?: string, method?: string): void {
    const event: TelegramClientFloodWaitEvent = {
      sessionId,
      userId,
      waitTime,
      method,
      timestamp: new Date(),
    };
    this.emit('flood-wait', event);
    this.logger.warn(
      `FloodWait: sessionId=${sessionId}, waitTime=${waitTime}s, method=${method || 'unknown'}`,
    );
  }

  /**
   * Подписка на событие подключения
   */
  onConnect(handler: (event: TelegramClientConnectEvent) => void): void {
    this.on('connect', handler);
  }

  /**
   * Подписка на событие отключения
   */
  onDisconnect(handler: (event: TelegramClientDisconnectEvent) => void): void {
    this.on('disconnect', handler);
  }

  /**
   * Подписка на событие ошибки
   */
  onError(handler: (event: TelegramClientErrorEvent) => void): void {
    this.on('error', handler);
  }

  /**
   * Подписка на событие invoke
   */
  onInvoke(handler: (event: TelegramClientInvokeEvent) => void): void {
    this.on('invoke', handler);
  }

  /**
   * Подписка на событие FloodWait
   */
  onFloodWait(handler: (event: TelegramClientFloodWaitEvent) => void): void {
    this.on('flood-wait', handler);
  }

  /**
   * Очистка всех слушателей при остановке модуля
   */
  onModuleDestroy() {
    this.removeAllListeners();
    this.logger.log('TelegramClientEventEmitter destroyed, all listeners removed');
  }
}