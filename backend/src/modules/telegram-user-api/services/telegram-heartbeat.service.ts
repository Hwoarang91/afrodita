import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { getErrorMessage, getErrorStack } from '../../../common/utils/error-message';
import { CircuitBreakerService } from '../../../common/services/circuit-breaker.service';
import { TelegramUserClientService } from './telegram-user-client.service';
import { TelegramConnectionMonitorService } from './telegram-connection-monitor.service';
import { Client } from '@mtkruto/node';
import { invokeWithRetry, type InvokeClient } from '../utils/mtproto-retry.utils';

interface HeartbeatStatus {
  sessionId: string;
  lastCheck: Date;
  isConnected: boolean;
  lastError?: string;
  consecutiveFailures: number;
}

@Injectable()
export class TelegramHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramHeartbeatService.name);
  private isEnabled = true;
  private heartbeatInterval = 120000;
  private heartbeatTimeout = 10000;
  private maxConsecutiveFailures = 3;
  private heartbeatStatuses: Map<string, HeartbeatStatus> = new Map();

  constructor(
    @Inject(forwardRef(() => TelegramUserClientService))
    private readonly telegramUserClientService: TelegramUserClientService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly circuitBreaker: CircuitBreakerService,
    @Optional() @Inject(forwardRef(() => TelegramConnectionMonitorService))
    private readonly connectionMonitorService?: TelegramConnectionMonitorService,
  ) {
    const interval = this.configService.get<number>('TELEGRAM_HEARTBEAT_INTERVAL');
    const timeout = this.configService.get<number>('TELEGRAM_HEARTBEAT_TIMEOUT');
    const enabled = this.configService.get<string>('TELEGRAM_HEARTBEAT_ENABLED');

    if (interval !== undefined) {
      this.heartbeatInterval = Math.min(600000, Math.max(60000, interval));
    }
    if (timeout !== undefined) {
      this.heartbeatTimeout = Math.min(60000, Math.max(5000, timeout));
    }
    if (enabled !== undefined) {
      const v = enabled.toLowerCase().trim();
      this.isEnabled = v === 'true' || v === '1' || v === 'yes';
    }
    if (this.heartbeatTimeout >= this.heartbeatInterval) {
      this.heartbeatTimeout = Math.floor(this.heartbeatInterval * 0.8);
    }
    this.logger.log(
      `TelegramHeartbeatService (User API): enabled=${this.isEnabled}, interval=${this.heartbeatInterval}ms, timeout=${this.heartbeatTimeout}ms`,
    );
  }

  onModuleInit() {
    if (this.isEnabled) {
      const interval = setInterval(() => this.checkAllClients(), this.heartbeatInterval);
      this.schedulerRegistry.addInterval('telegram-user-api-heartbeat', interval);
      this.logger.log('TelegramHeartbeatService (User API) started');
    }
  }

  onModuleDestroy() {
    this.isEnabled = false;
    try {
      const iv = this.schedulerRegistry.getInterval('telegram-user-api-heartbeat');
      if (iv) {
        clearInterval(iv);
        this.schedulerRegistry.deleteInterval('telegram-user-api-heartbeat');
      }
    } catch {
      /* noop */
    }
    this.logger.log('TelegramHeartbeatService stopped');
  }

  async checkAllClients() {
    if (!this.isEnabled) return;
    try {
      const clientsMap = (this.telegramUserClientService as unknown as { clients: Map<string, Client> }).clients;
      if (!clientsMap?.size) return;
      this.logger.debug(`Heartbeat: checking ${clientsMap.size} client(s)`);
      await Promise.allSettled(
        Array.from(clientsMap.entries()).map(([sid, c]) => this.checkClientConnection(sid, c)),
      );
    } catch (e: unknown) {
      this.logger.error(`Heartbeat error: ${getErrorMessage(e)}`, getErrorStack(e));
    }
  }

  private async checkClientConnection(sessionId: string, client: Client): Promise<void> {
    const status = this.heartbeatStatuses.get(sessionId) || {
      sessionId,
      lastCheck: new Date(0),
      isConnected: false,
      consecutiveFailures: 0,
    };

    try {
      if (!client.connected) {
        status.isConnected = false;
        status.consecutiveFailures++;
        status.lastError = 'Client is not connected';
        status.lastCheck = new Date();
        this.heartbeatStatuses.set(sessionId, status);
        this.connectionMonitorService?.updateHeartbeatStatus(
          sessionId,
          false,
          status.lastCheck,
          status.consecutiveFailures,
          status.lastError,
        );
        return;
      }

      const checkPromise = this.circuitBreaker.run('telegram-mtproto', () =>
        invokeWithRetry(client as InvokeClient, {
          _: 'users.getFullUser',
          id: { _: 'inputUserSelf' },
        }),
      );
      const timeoutPromise = new Promise<never>((_, rej) => {
        setTimeout(() => rej(new Error('Heartbeat timeout')), this.heartbeatTimeout);
      });
      await Promise.race([checkPromise, timeoutPromise]);

      status.isConnected = true;
      status.consecutiveFailures = 0;
      status.lastError = undefined;
      status.lastCheck = new Date();
      this.heartbeatStatuses.set(sessionId, status);
      this.connectionMonitorService?.updateHeartbeatStatus(sessionId, true, status.lastCheck, 0, undefined);
    } catch (e: unknown) {
      const errMsg = getErrorMessage(e);
      status.isConnected = false;
      status.consecutiveFailures++;
      status.lastError = errMsg;
      status.lastCheck = new Date();
      this.heartbeatStatuses.set(sessionId, status);
      if (status.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.logger.warn(`Heartbeat failed for ${sessionId} (${status.consecutiveFailures} failures): ${errMsg}`);
      }
      this.connectionMonitorService?.updateHeartbeatStatus(
        sessionId,
        false,
        status.lastCheck,
        status.consecutiveFailures,
        errMsg,
      );
    }
  }

  getHeartbeatStatus(sessionId: string): HeartbeatStatus | null {
    return this.heartbeatStatuses.get(sessionId) || null;
  }

  getAllHeartbeatStatuses(): Map<string, HeartbeatStatus> {
    return new Map(this.heartbeatStatuses);
  }

  clearHeartbeatStatus(sessionId: string): void {
    this.heartbeatStatuses.delete(sessionId);
  }
}
