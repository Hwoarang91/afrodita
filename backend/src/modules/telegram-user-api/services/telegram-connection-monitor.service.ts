import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional, Inject, forwardRef } from '@nestjs/common';
import { getErrorMessage } from '../../../common/utils/error-message';
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
  lastActivity: Date | null;
  lastHeartbeatCheck: Date | null;
  lastHeartbeatStatus: boolean | null;
  consecutiveHeartbeatFailures: number;
  lastError?: string;
  connectionState: 'connected' | 'disconnected' | 'unknown' | 'error';
  lastInvokeMethod?: string;
  lastInvokeDuration?: number;
  createdAt: Date;
  lastUsedAt: Date | null;
}

@Injectable()
export class TelegramConnectionMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramConnectionMonitorService.name);
  private connectionStatuses: Map<string, ConnectionStatus> = new Map();

  constructor(
    @InjectRepository(TelegramUserSession)
    private readonly sessionRepository: Repository<TelegramUserSession>,
    @Optional() @Inject(forwardRef(() => TelegramClientEventEmitter))
    private readonly eventEmitter?: TelegramClientEventEmitter,
  ) {
    this.logger.log('TelegramConnectionMonitorService (User API) initialized');
  }

  onModuleInit() {
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
    }
  }

  onModuleDestroy() {
    this.connectionStatuses.clear();
    this.logger.log('TelegramConnectionMonitorService destroyed');
  }

  private updateConnectionStatus(
    sessionId: string,
    updates: Partial<Omit<ConnectionStatus, 'sessionId'>>,
  ): void {
    const existingStatus = this.connectionStatuses.get(sessionId);

    if (existingStatus) {
      Object.assign(existingStatus, updates);
      this.connectionStatuses.set(sessionId, existingStatus);
    } else {
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
        .catch((error: unknown) => {
          this.logger.warn(`Failed to load session info for ${sessionId}: ${getErrorMessage(error)}`);
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
        status.connectionState = 'connected';
        status.lastError = undefined;
      }
      if (isConnected) {
        status.isConnected = true;
        if (status.connectionState === 'unknown') status.connectionState = 'connected';
      } else if (consecutiveFailures >= 3) {
        status.isConnected = false;
        status.connectionState = 'disconnected';
      }
      this.connectionStatuses.set(sessionId, status);
    } else {
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
          connectionState: isConnected
            ? 'connected'
            : consecutiveFailures >= 3
              ? 'disconnected'
              : 'error',
          createdAt: sessionInfo?.createdAt || new Date(),
          lastUsedAt: sessionInfo?.lastUsedAt || null,
        };
        this.connectionStatuses.set(sessionId, newStatus);
      });
    }
  }

  getConnectionStatus(sessionId: string): ConnectionStatus | null {
    return this.connectionStatuses.get(sessionId) || null;
  }

  getAllConnectionStatuses(): ConnectionStatus[] {
    return Array.from(this.connectionStatuses.values());
  }

  getConnectionStatusesByUserId(userId: string): ConnectionStatus[] {
    return Array.from(this.connectionStatuses.values()).filter((s) => s.userId === userId);
  }

  removeConnectionStatus(sessionId: string): void {
    this.connectionStatuses.delete(sessionId);
    this.logger.debug(`Connection status removed for session ${sessionId}`);
  }

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
