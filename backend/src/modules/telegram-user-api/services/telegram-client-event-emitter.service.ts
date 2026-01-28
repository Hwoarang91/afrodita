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
  duration?: number;
}

export interface TelegramClientFloodWaitEvent {
  sessionId: string;
  userId?: string;
  waitTime: number;
  method?: string;
  timestamp: Date;
}

@Injectable()
export class TelegramClientEventEmitter extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(TelegramClientEventEmitter.name);

  constructor() {
    super();
    this.setMaxListeners(50);
    this.logger.log('TelegramClientEventEmitter (User API) initialized');
  }

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
      this.logger.debug(`Invoke completed: sessionId=${sessionId}, method=${method}, duration=${duration}ms`);
    }
  }

  emitFloodWait(sessionId: string, waitTime: number, userId?: string, method?: string): void {
    const event: TelegramClientFloodWaitEvent = {
      sessionId,
      userId,
      waitTime,
      method,
      timestamp: new Date(),
    };
    this.emit('flood-wait', event);
    this.logger.warn(`FloodWait: sessionId=${sessionId}, waitTime=${waitTime}s, method=${method || 'unknown'}`);
  }

  onConnect(handler: (event: TelegramClientConnectEvent) => void): void {
    this.on('connect', handler);
  }

  onDisconnect(handler: (event: TelegramClientDisconnectEvent) => void): void {
    this.on('disconnect', handler);
  }

  onError(handler: (event: TelegramClientErrorEvent) => void): void {
    this.on('error', handler);
  }

  onInvoke(handler: (event: TelegramClientInvokeEvent) => void): void {
    this.on('invoke', handler);
  }

  onFloodWait(handler: (event: TelegramClientFloodWaitEvent) => void): void {
    this.on('flood-wait', handler);
  }

  onModuleDestroy() {
    this.removeAllListeners();
    this.logger.log('TelegramClientEventEmitter destroyed, all listeners removed');
  }
}
