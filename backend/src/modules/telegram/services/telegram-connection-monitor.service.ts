import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional, Inject, forwardRef } from '@nestjs/common';
import { getErrorMessage } from '../../../common/utils/error-message';
import { TelegramHeartbeatService } from './telegram-heartbeat.service';
import {
  TelegramClientEventEmitter,
  TelegramClientConnectEvent,
  TelegramClientDisconnectEvent,
  TelegramClientInvokeEvent,
  TelegramClientErrorEvent,
} from './telegram-client-event-emitter.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';

export interface ConnectionStatus {
  sessionId: string;
  userId: string;
  phoneNumber?: string | null;
  isConnected: boolean;
  lastActivity: Date | null; // Последняя активность (invoke, connect)
  lastHeartbeatCheck: Date | null; // Последняя проверка heartbeat
  lastHeartbeatStatus: boolean | null; // Результат последней проверки heartbeat
  consecutiveHeartbeatFailures: number;
  lastError?: string;
  connectionState: 'connected' | 'disconnected' | 'unknown' | 'error'; // Текущее состояние соединения
  lastInvokeMethod?: string; // Последний вызванный метод
  lastInvokeDuration?: number; // Длительность последнего invoke
  createdAt: Date; // Время создания сессии
  lastUsedAt: Date | null; // Время последнего использования сессии
}

/**
 * Сервис мониторинга статуса Telegram клиентов
 * Агрегирует информацию из HeartbeatService и TelegramClientEventEmitter
 */
@Injectable()
export class TelegramConnectionMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramConnectionMonitorService.name);
  
  // Хранилище статусов соединений всех активных клиентов
  private connectionStatuses: Map<string, ConnectionStatus> = new Map();

  constructor(
    @InjectRepository(TelegramUserSession)
    private readonly sessionRepository: Repository<TelegramUserSession>,
    @Optional() @Inject(forwardRef(() => TelegramHeartbeatService))
    private readonly heartbeatService?: TelegramHeartbeatService,
    @Optional() @Inject(forwardRef(() => TelegramClientEventEmitter))
    private readonly eventEmitter?: TelegramClientEventEmitter,
  ) {
    this.logger.log('TelegramConnectionMonitorService initialized');
    if (this.heartbeatService) {
      this.logger.log('HeartbeatService integration enabled');
    } else {
      this.logger.debug('HeartbeatService not available (optional)');
    }
    if (this.eventEmitter) {
      this.logger.log('TelegramClientEventEmitter integration enabled');
    } else {
      this.logger.debug('TelegramClientEventEmitter not available (optional)');
    }
  }

  onModuleInit() {
    // Подписываемся на события TelegramClientEventEmitter для отслеживания активности
    if (this.eventEmitter) {
      this.eventEmitter.onConnect((event: TelegramClientConnectEvent) => {
        this.updateConnectionStatus(event.sessionId, {
          isConnected: true,
          connectionState: 'connected',
          lastActivity: event.timestamp,
          userId: event.userId,
          phoneNumber: event.phoneNumber || null,
        });
      });

      this.eventEmitter.onDisconnect((event: TelegramClientDisconnectEvent) => {
        this.updateConnectionStatus(event.sessionId, {
          isConnected: false,
          connectionState: 'disconnected',
          lastActivity: event.timestamp,
          lastError: event.reason,
        });
      });

      this.eventEmitter.onInvoke((event: TelegramClientInvokeEvent) => {
        this.updateConnectionStatus(event.sessionId, {
          lastActivity: event.timestamp,
          lastInvokeMethod: event.method,
          lastInvokeDuration: event.duration,
        });
      });

      this.eventEmitter.onError((event: TelegramClientErrorEvent) => {
        this.updateConnectionStatus(event.sessionId, {
          connectionState: 'error',
          lastError: event.error.message,
          lastActivity: event.timestamp,
        });
      });

      this.logger.log('Subscribed to TelegramClientEventEmitter events');
    } else {
      this.logger.debug('TelegramClientEventEmitter not available (optional)');
    }
  }

  onModuleDestroy() {
    this.connectionStatuses.clear();
    this.logger.log('TelegramConnectionMonitorService destroyed');
  }

  /**
   * Обновление статуса соединения клиента
   */
  private updateConnectionStatus(
    sessionId: string,
    updates: Partial<Omit<ConnectionStatus, 'sessionId'>>,
  ): void {
    const existingStatus = this.connectionStatuses.get(sessionId);
    
    if (existingStatus) {
      // Обновляем существующий статус
      Object.assign(existingStatus, updates);
      this.connectionStatuses.set(sessionId, existingStatus);
    } else {
      // Создаем новый статус, если его нет
      // Попытаемся получить информацию из БД
      this.loadSessionInfo(sessionId)
        .then((sessionInfo) => {
          const newStatus: ConnectionStatus = {
            sessionId,
            userId: updates.userId || sessionInfo?.userId || 'unknown',
            phoneNumber: updates.phoneNumber ?? sessionInfo?.phoneNumber ?? null,
            isConnected: updates.isConnected ?? false,
            lastActivity: updates.lastActivity ?? null,
            lastHeartbeatCheck: null,
            lastHeartbeatStatus: null,
            consecutiveHeartbeatFailures: 0,
            lastError: updates.lastError,
            connectionState: updates.connectionState || 'unknown',
            lastInvokeMethod: updates.lastInvokeMethod,
            lastInvokeDuration: updates.lastInvokeDuration,
            createdAt: sessionInfo?.createdAt || new Date(),
            lastUsedAt: sessionInfo?.lastUsedAt || null,
          };
          
          Object.assign(newStatus, updates);
          this.connectionStatuses.set(sessionId, newStatus);
        })
        .catch((error) => {
          this.logger.warn(`Failed to load session info for ${sessionId}: ${error.message}`);
          // Создаем минимальный статус без информации из БД
          const newStatus: ConnectionStatus = {
            sessionId,
            userId: updates.userId || 'unknown',
            phoneNumber: updates.phoneNumber ?? null,
            isConnected: updates.isConnected ?? false,
            lastActivity: updates.lastActivity ?? null,
            lastHeartbeatCheck: null,
            lastHeartbeatStatus: null,
            consecutiveHeartbeatFailures: 0,
            lastError: updates.lastError,
            connectionState: updates.connectionState || 'unknown',
            lastInvokeMethod: updates.lastInvokeMethod,
            lastInvokeDuration: updates.lastInvokeDuration,
            createdAt: new Date(),
            lastUsedAt: null,
          };
          
          Object.assign(newStatus, updates);
          this.connectionStatuses.set(sessionId, newStatus);
        });
    }
  }

  /**
   * Загрузка информации о сессии из БД
   */
  private async loadSessionInfo(
    sessionId: string,
  ): Promise<{ userId: string; phoneNumber: string | null; createdAt: Date; lastUsedAt: Date | null } | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        select: ['userId', 'phoneNumber', 'createdAt', 'lastUsedAt'],
      });
      
      if (session) {
        return {
          userId: session.userId,
          phoneNumber: session.phoneNumber,
          createdAt: session.createdAt,
          lastUsedAt: session.lastUsedAt,
        };
      }
      return null;
    } catch (error: unknown) {
      this.logger.error(`Error loading session info for ${sessionId}: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Обновление статуса heartbeat из HeartbeatService
   * Вызывается периодически из HeartbeatService
   */
  updateHeartbeatStatus(
    sessionId: string,
    isConnected: boolean,
    lastCheck: Date,
    consecutiveFailures: number,
    lastError?: string,
  ): void {
    const status = this.connectionStatuses.get(sessionId);
    
    if (status) {
      status.lastHeartbeatCheck = lastCheck;
      status.lastHeartbeatStatus = isConnected;
      status.consecutiveHeartbeatFailures = consecutiveFailures;
      
      if (!isConnected && lastError) {
        status.lastError = lastError;
        status.connectionState = 'error';
      } else if (isConnected && status.connectionState === 'error') {
        // Восстанавливаем статус, если heartbeat снова успешен
        status.connectionState = 'connected';
        status.lastError = undefined;
      }
      
      // Обновляем общий статус соединения на основе heartbeat
      if (isConnected) {
        status.isConnected = true;
        if (status.connectionState === 'unknown') {
          status.connectionState = 'connected';
        }
      } else if (consecutiveFailures >= 3) {
        // Если 3+ последовательных неудач - помечаем как disconnected
        status.isConnected = false;
        status.connectionState = 'disconnected';
      }
      
      this.connectionStatuses.set(sessionId, status);
    } else {
      // Создаем новый статус, если его нет
      this.loadSessionInfo(sessionId).then((sessionInfo) => {
        const newStatus: ConnectionStatus = {
          sessionId,
          userId: sessionInfo?.userId || 'unknown',
          phoneNumber: sessionInfo?.phoneNumber ?? null,
          isConnected,
          lastActivity: null,
          lastHeartbeatCheck: lastCheck,
          lastHeartbeatStatus: isConnected,
          consecutiveHeartbeatFailures: consecutiveFailures,
          lastError,
          connectionState: isConnected ? 'connected' : consecutiveFailures >= 3 ? 'disconnected' : 'error',
          createdAt: sessionInfo?.createdAt || new Date(),
          lastUsedAt: sessionInfo?.lastUsedAt || null,
        };
        this.connectionStatuses.set(sessionId, newStatus);
      });
    }
  }

  /**
   * Получение статуса соединения конкретного клиента
   */
  getConnectionStatus(sessionId: string): ConnectionStatus | null {
    return this.connectionStatuses.get(sessionId) || null;
  }

  /**
   * Получение статусов всех активных клиентов
   */
  getAllConnectionStatuses(): ConnectionStatus[] {
    return Array.from(this.connectionStatuses.values());
  }

  /**
   * Получение статусов клиентов пользователя
   */
  getConnectionStatusesByUserId(userId: string): ConnectionStatus[] {
    return Array.from(this.connectionStatuses.values()).filter((status) => status.userId === userId);
  }

  /**
   * Удаление статуса клиента (при деактивации сессии)
   */
  removeConnectionStatus(sessionId: string): void {
    this.connectionStatuses.delete(sessionId);
    this.logger.debug(`Connection status removed for session ${sessionId}`);
  }

  /**
   * Получение статистики соединений
   */
  getConnectionStatistics(): {
    total: number;
    connected: number;
    disconnected: number;
    error: number;
    unknown: number;
  } {
    const statuses = Array.from(this.connectionStatuses.values());
    
    return {
      total: statuses.length,
      connected: statuses.filter((s) => s.connectionState === 'connected' && s.isConnected).length,
      disconnected: statuses.filter((s) => s.connectionState === 'disconnected').length,
      error: statuses.filter((s) => s.connectionState === 'error').length,
      unknown: statuses.filter((s) => s.connectionState === 'unknown').length,
    };
  }
}