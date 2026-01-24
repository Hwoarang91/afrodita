import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, forwardRef } from '@nestjs/common';
import {
  TelegramClientEventEmitter,
  TelegramClientConnectEvent,
  TelegramClientDisconnectEvent,
  TelegramClientErrorEvent,
  TelegramClientInvokeEvent,
  TelegramClientFloodWaitEvent,
} from '../telegram/services/telegram-client-event-emitter.service';

interface EventLogSubscription {
  socketId: string;
  eventTypes?: string[]; // Фильтр по типам событий: 'connect', 'disconnect', 'error', 'invoke', 'flood-wait'
  sessionIds?: string[]; // Фильтр по sessionId (если не указан - все сессии)
}

@WSGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private logger: Logger = new Logger('WebSocketGateway');
  
  // Храним подписки клиентов на sessionId для статуса соединения
  private clientSubscriptions: Map<string, Set<string>> = new Map(); // sessionId -> Set<socketId>
  
  // Храним подписки клиентов на event log с фильтрами
  private eventLogSubscriptions: Map<string, EventLogSubscription> = new Map(); // socketId -> subscription
  
  // Rate limiting для event log (события в секунду)
  private readonly maxEventsPerSecond = 100; // Максимум 100 событий в секунду на клиента
  private eventLogRateLimiter: Map<string, { count: number; resetAt: number }> = new Map(); // socketId -> rate limit state

  constructor(
    @Optional() @Inject(forwardRef(() => TelegramClientEventEmitter))
    private readonly telegramEventEmitter?: TelegramClientEventEmitter,
  ) {
    this.logger.log('WebSocketGateway initialized');
    if (this.telegramEventEmitter) {
      this.logger.log('TelegramClientEventEmitter integration enabled');
    } else {
      this.logger.debug('TelegramClientEventEmitter not available (optional)');
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Удаляем клиента из всех подписок
    this.removeClientFromAllSubscriptions(client.id);
  }

  onModuleInit() {
    // Подписываемся на события TelegramClientEventEmitter для передачи через WebSocket
    if (this.telegramEventEmitter) {
      this.telegramEventEmitter.onConnect((event: TelegramClientConnectEvent) => {
        this.emitTelegramConnectionStatus(event.sessionId, 'connected', {
          sessionId: event.sessionId,
          userId: event.userId,
          phoneNumber: event.phoneNumber,
          timestamp: event.timestamp,
        });
      });

      this.telegramEventEmitter.onDisconnect((event: TelegramClientDisconnectEvent) => {
        this.emitTelegramConnectionStatus(event.sessionId, 'disconnected', {
          sessionId: event.sessionId,
          userId: event.userId,
          reason: event.reason,
          timestamp: event.timestamp,
        });
      });

      this.telegramEventEmitter.onError((event: TelegramClientErrorEvent) => {
        this.emitTelegramConnectionStatus(event.sessionId, 'error', {
          sessionId: event.sessionId,
          userId: event.userId,
          error: event.error.message,
          context: event.context,
          timestamp: event.timestamp,
        });
      });

      // Подписываемся на все события для event log (Task 3.1)
      this.telegramEventEmitter.onConnect((event: TelegramClientConnectEvent) => {
        this.emitTelegramEventLog('connect', {
          sessionId: event.sessionId,
          userId: event.userId,
          phoneNumber: event.phoneNumber,
          timestamp: event.timestamp,
        });
      });

      this.telegramEventEmitter.onDisconnect((event: TelegramClientDisconnectEvent) => {
        this.emitTelegramEventLog('disconnect', {
          sessionId: event.sessionId,
          userId: event.userId,
          reason: event.reason,
          timestamp: event.timestamp,
        });
      });

      this.telegramEventEmitter.onError((event: TelegramClientErrorEvent) => {
        this.emitTelegramEventLog('error', {
          sessionId: event.sessionId,
          userId: event.userId,
          error: event.error.message,
          errorStack: event.error.stack,
          context: event.context,
          timestamp: event.timestamp,
        });
      });

      this.telegramEventEmitter.onInvoke((event: TelegramClientInvokeEvent) => {
        this.emitTelegramEventLog('invoke', {
          sessionId: event.sessionId,
          userId: event.userId,
          method: event.method,
          duration: event.duration,
          timestamp: event.timestamp,
        });
      });

      this.telegramEventEmitter.onFloodWait((event: TelegramClientFloodWaitEvent) => {
        this.emitTelegramEventLog('flood-wait', {
          sessionId: event.sessionId,
          userId: event.userId,
          waitTime: event.waitTime,
          method: event.method,
          timestamp: event.timestamp,
        });
      });

      this.logger.log('Subscribed to TelegramClientEventEmitter events for connection status and event log');
    }
  }

  onModuleDestroy() {
    // Очищаем подписки
    this.clientSubscriptions.clear();
    this.eventLogSubscriptions.clear();
    this.eventLogRateLimiter.clear();
    this.logger.log('WebSocketGateway destroyed');
  }

  @SubscribeMessage('subscribe-slots')
  handleSubscribeSlots(client: Socket, data: { masterId: string; serviceId: string; date: string }) {
    client.join(`slots:${data.masterId}:${data.serviceId}:${data.date}`);
  }

  emitSlotUpdate(masterId: string, serviceId: string, date: string, slots: Date[]) {
    this.server.to(`slots:${masterId}:${serviceId}:${date}`).emit('slot-update', { slots });
  }

  emitNewAppointment(appointment: any) {
    this.server.emit('new-appointment', appointment);
  }

  emitAppointmentStatusChange(appointmentId: string, status: string) {
    this.server.emit('appointment-status-change', { appointmentId, status });
  }

  // Синхронизация данных между админ панелями
  emitDataSync(type: 'appointment' | 'user' | 'master' | 'service' | 'telegram-chat', action: 'create' | 'update' | 'delete', data: any) {
    this.server.emit('data-sync', { type, action, data });
  }

  emitTelegramMessageSent(chatId: string, messageId: number) {
    this.server.emit('telegram-message-sent', { chatId, messageId });
  }

  emitScheduledMessageStatusChange(messageId: string, status: string) {
    this.server.emit('scheduled-message-status-change', { messageId, status });
  }

  /**
   * Подписка клиента на статус соединения Telegram сессии
   * Клиент будет получать события статуса соединения для указанной sessionId
   */
  @SubscribeMessage('subscribe-telegram-status')
  handleSubscribeTelegramStatus(client: Socket, data: { sessionId: string }): void {
    if (!data?.sessionId) {
      this.logger.warn(`Client ${client.id} attempted to subscribe without sessionId`);
      client.emit('telegram-status-error', { error: 'sessionId is required' });
      return;
    }

    const { sessionId } = data;
    const roomName = `telegram:${sessionId}`;
    
    // Добавляем клиента в комнату для этой сессии
    client.join(roomName);
    
    // Сохраняем подписку для отслеживания
    if (!this.clientSubscriptions.has(sessionId)) {
      this.clientSubscriptions.set(sessionId, new Set());
    }
    this.clientSubscriptions.get(sessionId)!.add(client.id);
    
    this.logger.debug(`Client ${client.id} subscribed to Telegram status for session ${sessionId}`);
    
    // Отправляем подтверждение подписки
    client.emit('telegram-status-subscribed', { sessionId });
  }

  /**
   * Отписка клиента от статуса соединения Telegram сессии
   */
  @SubscribeMessage('unsubscribe-telegram-status')
  handleUnsubscribeTelegramStatus(client: Socket, data: { sessionId: string }): void {
    if (!data?.sessionId) {
      this.logger.warn(`Client ${client.id} attempted to unsubscribe without sessionId`);
      return;
    }

    const { sessionId } = data;
    const roomName = `telegram:${sessionId}`;
    
    // Удаляем клиента из комнаты
    client.leave(roomName);
    
    // Удаляем из подписок
    const subscriptions = this.clientSubscriptions.get(sessionId);
    if (subscriptions) {
      subscriptions.delete(client.id);
      if (subscriptions.size === 0) {
        this.clientSubscriptions.delete(sessionId);
      }
    }
    
    this.logger.debug(`Client ${client.id} unsubscribed from Telegram status for session ${sessionId}`);
    
    // Отправляем подтверждение отписки
    client.emit('telegram-status-unsubscribed', { sessionId });
  }

  /**
   * Отправка события статуса соединения Telegram клиента подписанным клиентам
   * @param sessionId ID Telegram сессии
   * @param status Статус соединения: 'connected' | 'disconnected' | 'error' | 'heartbeat'
   * @param data Дополнительные данные события
   */
  public emitTelegramConnectionStatus(
    sessionId: string,
    status: 'connected' | 'disconnected' | 'error' | 'heartbeat',
    data: {
      sessionId: string;
      userId?: string;
      phoneNumber?: string;
      reason?: string;
      error?: string;
      context?: string;
      isConnected?: boolean;
      lastCheck?: Date;
      timestamp: Date;
    },
  ): void {
    const roomName = `telegram:${sessionId}`;
    
    const eventData = {
      ...data,
      sessionId,
      status,
      timestamp: data.timestamp instanceof Date ? data.timestamp.toISOString() : data.timestamp,
    };

    // Отправляем событие только подписанным клиентам
    this.server.to(roomName).emit('telegram-connection-status', eventData);
    
    this.logger.debug(
      `Emitted telegram-connection-status: sessionId=${sessionId}, status=${status}, subscribers=${this.clientSubscriptions.get(sessionId)?.size || 0}`,
    );
  }

  /**
   * Удаление клиента из всех подписок при отключении
   */
  private removeClientFromAllSubscriptions(socketId: string): void {
    for (const [sessionId, subscribers] of this.clientSubscriptions.entries()) {
      if (subscribers.has(socketId)) {
        subscribers.delete(socketId);
        if (subscribers.size === 0) {
          this.clientSubscriptions.delete(sessionId);
        }
        this.logger.debug(`Removed client ${socketId} from subscription for session ${sessionId}`);
      }
    }
  }

  /**
   * Получение количества подписчиков на статус конкретной сессии
   */
  getSubscriberCount(sessionId: string): number {
    return this.clientSubscriptions.get(sessionId)?.size || 0;
  }

  /**
   * Подписка клиента на MTProto event log с фильтрацией
   * @param client Socket клиент
   * @param data Параметры подписки: { eventTypes?: string[], sessionIds?: string[] }
   */
  @SubscribeMessage('subscribe-telegram-event-log')
  handleSubscribeTelegramEventLog(
    client: Socket,
    data: { eventTypes?: string[]; sessionIds?: string[] },
  ): void {
    const subscription: EventLogSubscription = {
      socketId: client.id,
      eventTypes: data.eventTypes || undefined, // Если не указано - все типы
      sessionIds: data.sessionIds || undefined, // Если не указано - все сессии
    };

    this.eventLogSubscriptions.set(client.id, subscription);
    this.logger.debug(
      `Client ${client.id} subscribed to Telegram event log: eventTypes=${subscription.eventTypes?.join(',') || 'all'}, sessionIds=${subscription.sessionIds?.join(',') || 'all'}`,
    );

    // Отправляем подтверждение подписки
    client.emit('telegram-event-log-subscribed', {
      eventTypes: subscription.eventTypes || 'all',
      sessionIds: subscription.sessionIds || 'all',
    });
  }

  /**
   * Отписка клиента от MTProto event log
   */
  @SubscribeMessage('unsubscribe-telegram-event-log')
  handleUnsubscribeTelegramEventLog(client: Socket): void {
    this.eventLogSubscriptions.delete(client.id);
    this.eventLogRateLimiter.delete(client.id);
    this.logger.debug(`Client ${client.id} unsubscribed from Telegram event log`);

    // Отправляем подтверждение отписки
    client.emit('telegram-event-log-unsubscribed');
  }

  /**
   * Проверка rate limit для клиента
   * @param socketId ID сокета клиента
   * @returns true если можно отправить событие, false если превышен лимит
   */
  private checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    const limit = this.eventLogRateLimiter.get(socketId) || null;

    if (!limit || now >= limit.resetAt) {
      // Создаем новый лимит или сбрасываем существующий
      this.eventLogRateLimiter.set(socketId, {
        count: 1,
        resetAt: now + 1000, // Сброс через 1 секунду
      });
      return true;
    }

    if (limit.count >= this.maxEventsPerSecond) {
      // Превышен лимит
      return false;
    }

    // Увеличиваем счетчик
    limit.count++;
    return true;
  }

  /**
   * Отправка MTProto event log подписанным клиентам с фильтрацией и rate limiting
   * @param eventType Тип события: 'connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait'
   * @param eventData Данные события
   */
  private emitTelegramEventLog(
    eventType: 'connect' | 'disconnect' | 'error' | 'invoke' | 'flood-wait',
    eventData: {
      sessionId: string;
      userId?: string;
      phoneNumber?: string;
      reason?: string;
      error?: string;
      errorStack?: string;
      context?: string;
      method?: string;
      duration?: number;
      waitTime?: number;
      timestamp: Date;
    },
  ): void {
    const eventLogData = {
      type: eventType,
      ...eventData,
      timestamp: eventData.timestamp instanceof Date ? eventData.timestamp.toISOString() : eventData.timestamp,
    };

    // Отправляем событие только подписанным клиентам с учетом фильтров
    for (const [socketId, subscription] of this.eventLogSubscriptions.entries()) {
      // Проверяем фильтр по типу события
      if (subscription.eventTypes && !subscription.eventTypes.includes(eventType)) {
        continue; // Пропускаем, если тип события не в фильтре
      }

      // Проверяем фильтр по sessionId
      if (subscription.sessionIds && !subscription.sessionIds.includes(eventData.sessionId)) {
        continue; // Пропускаем, если sessionId не в фильтре
      }

      // Проверяем rate limit (Task 3.1)
      if (!this.checkRateLimit(socketId)) {
        this.logger.debug(
          `Rate limit exceeded for client ${socketId}, skipping event ${eventType} for session ${eventData.sessionId}`,
        );
        continue; // Пропускаем, если превышен лимит
      }

      // Отправляем событие клиенту
      const client = this.server.sockets.sockets.get(socketId);
      if (client) {
        client.emit('telegram-event-log', eventLogData);
      } else {
        // Клиент отключился, удаляем подписку
        this.eventLogSubscriptions.delete(socketId);
        this.eventLogRateLimiter.delete(socketId);
      }
    }

    this.logger.debug(
      `Emitted telegram-event-log: type=${eventType}, sessionId=${eventData.sessionId}, subscribers=${this.eventLogSubscriptions.size}`,
    );
  }

  /**
   * Получение количества подписчиков на event log
   */
  getEventLogSubscriberCount(): number {
    return this.eventLogSubscriptions.size;
  }
}

