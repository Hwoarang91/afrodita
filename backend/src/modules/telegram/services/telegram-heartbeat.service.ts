import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
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
  private heartbeatInterval: number = 120000; // 2 минуты по умолчанию
  private heartbeatTimeout: number = 10000; // 10 секунд таймаут для проверки
  private maxConsecutiveFailures = 3; // Максимум последовательных неудач перед логированием ошибки
  private heartbeatStatuses: Map<string, HeartbeatStatus> = new Map();

  constructor(
    @Inject(forwardRef(() => TelegramUserClientService))
    private readonly telegramUserClientService: TelegramUserClientService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Optional() @Inject(forwardRef(() => TelegramConnectionMonitorService))
    private readonly connectionMonitorService?: TelegramConnectionMonitorService,
  ) {
    // Получаем и валидируем конфигурацию из переменных окружения
    const interval = this.configService.get<number>('TELEGRAM_HEARTBEAT_INTERVAL');
    const timeout = this.configService.get<number>('TELEGRAM_HEARTBEAT_TIMEOUT');
    const enabled = this.configService.get<string>('TELEGRAM_HEARTBEAT_ENABLED');

    // Валидация интервала проверки (минимум 60 секунд, максимум 10 минут)
    if (interval !== undefined) {
      if (interval < 60000) {
        this.logger.warn(
          `TELEGRAM_HEARTBEAT_INTERVAL (${interval}ms) is less than minimum (60000ms), using minimum value`,
        );
        this.heartbeatInterval = 60000;
      } else if (interval > 600000) {
        this.logger.warn(
          `TELEGRAM_HEARTBEAT_INTERVAL (${interval}ms) is greater than maximum (600000ms), using maximum value`,
        );
        this.heartbeatInterval = 600000;
      } else {
        this.heartbeatInterval = interval;
      }
    }

    // Валидация таймаута проверки (минимум 5 секунд, максимум 60 секунд)
    if (timeout !== undefined) {
      if (timeout < 5000) {
        this.logger.warn(
          `TELEGRAM_HEARTBEAT_TIMEOUT (${timeout}ms) is less than minimum (5000ms), using minimum value`,
        );
        this.heartbeatTimeout = 5000;
      } else if (timeout > 60000) {
        this.logger.warn(
          `TELEGRAM_HEARTBEAT_TIMEOUT (${timeout}ms) is greater than maximum (60000ms), using maximum value`,
        );
        this.heartbeatTimeout = 60000;
      } else {
        this.heartbeatTimeout = timeout;
      }
    }

    // Валидация включения/выключения heartbeat
    if (enabled !== undefined) {
      const enabledLower = enabled.toLowerCase().trim();
      if (enabledLower === 'true' || enabledLower === '1' || enabledLower === 'yes') {
        this.isEnabled = true;
      } else if (enabledLower === 'false' || enabledLower === '0' || enabledLower === 'no') {
        this.isEnabled = false;
      } else {
        this.logger.warn(
          `TELEGRAM_HEARTBEAT_ENABLED has invalid value "${enabled}", expected "true"/"false", using default: true`,
        );
        this.isEnabled = true;
      }
    }

    // Дополнительная проверка: таймаут не должен быть больше интервала
    if (this.heartbeatTimeout >= this.heartbeatInterval) {
      this.logger.warn(
        `TELEGRAM_HEARTBEAT_TIMEOUT (${this.heartbeatTimeout}ms) is greater than or equal to TELEGRAM_HEARTBEAT_INTERVAL (${this.heartbeatInterval}ms), setting timeout to ${Math.floor(this.heartbeatInterval * 0.8)}ms (80% of interval)`,
      );
      this.heartbeatTimeout = Math.floor(this.heartbeatInterval * 0.8);
    }

    this.logger.log(
      `TelegramHeartbeatService initialized: enabled=${this.isEnabled}, interval=${this.heartbeatInterval}ms (${Math.floor(this.heartbeatInterval / 1000)}s), timeout=${this.heartbeatTimeout}ms (${Math.floor(this.heartbeatTimeout / 1000)}s)`,
    );
  }

  onModuleInit() {
    if (this.isEnabled) {
      // Регистрируем периодическую задачу с динамическим интервалом
      const interval = setInterval(() => {
        this.checkAllClients();
      }, this.heartbeatInterval);

      this.schedulerRegistry.addInterval('telegram-heartbeat', interval);
      this.logger.log(`✅ TelegramHeartbeatService started with interval ${this.heartbeatInterval}ms`);
    } else {
      this.logger.log('⚠️ TelegramHeartbeatService is disabled');
    }
  }

  onModuleDestroy() {
    this.isEnabled = false;
    try {
      const interval = this.schedulerRegistry.getInterval('telegram-heartbeat');
      if (interval) {
        clearInterval(interval);
        this.schedulerRegistry.deleteInterval('telegram-heartbeat');
      }
    } catch (error) {
      // Интервал может не существовать - это нормально
    }
    this.logger.log('TelegramHeartbeatService stopped');
  }

  /**
   * Периодическая проверка соединения всех активных MTProto клиентов
   * Использует @Interval декоратор для запуска каждые N миллисекунд
   * Динамически устанавливаем интервал через SchedulerRegistry
   */
  async checkAllClients() {
    if (!this.isEnabled) {
      return;
    }

    try {
      // Получаем все активные клиенты через приватное поле clients
      // Используем рефлексию для доступа к приватному Map
      const clientsMap = (this.telegramUserClientService as any).clients as Map<string, Client>;

      if (!clientsMap || clientsMap.size === 0) {
        this.logger.debug('No active clients to check');
        return;
      }

      this.logger.debug(`Checking ${clientsMap.size} active client(s)...`);

      const checkPromises: Promise<void>[] = [];

      for (const [sessionId, client] of clientsMap.entries()) {
        checkPromises.push(this.checkClientConnection(sessionId, client));
      }

      await Promise.allSettled(checkPromises);
    } catch (error: any) {
      this.logger.error(`Error during heartbeat check: ${error.message}`, error.stack);
    }
  }

  /**
   * Проверка соединения конкретного клиента
   * Использует простой getMe() запрос для проверки соединения
   */
  private async checkClientConnection(sessionId: string, client: Client): Promise<void> {
    const status = this.heartbeatStatuses.get(sessionId) || {
      sessionId,
      lastCheck: new Date(0),
      isConnected: false,
      consecutiveFailures: 0,
    };

    try {
      // Проверяем, что клиент подключен
      if (!client.connected) {
        status.isConnected = false;
        status.consecutiveFailures++;
        status.lastError = 'Client is not connected';
        status.lastCheck = new Date();
        this.heartbeatStatuses.set(sessionId, status);

        if (status.consecutiveFailures >= this.maxConsecutiveFailures) {
          this.logger.warn(
            `⚠️ Client ${sessionId} is disconnected (${status.consecutiveFailures} consecutive failures)`,
          );
        }

        // Уведомляем ConnectionMonitorService об обновлении статуса (Task 2.3)
        this.connectionMonitorService?.updateHeartbeatStatus(
          sessionId,
          false,
          status.lastCheck,
          status.consecutiveFailures,
          'Client is not connected',
        );

        return;
      }

      // Выполняем легковесный запрос для проверки соединения (с retry при FLOOD_WAIT)
      const checkPromise = invokeWithRetry(client as InvokeClient, {
        _: 'users.getFullUser',
        id: { _: 'inputUserSelf' },
      });

      // Оборачиваем в Promise.race для таймаута
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Heartbeat timeout')), this.heartbeatTimeout);
      });

      await Promise.race([checkPromise, timeoutPromise]);

      // Успешная проверка
      status.isConnected = true;
      status.consecutiveFailures = 0;
      status.lastError = undefined;
      status.lastCheck = new Date();
      this.heartbeatStatuses.set(sessionId, status);
      
      this.logger.debug(`✅ Client ${sessionId} heartbeat check passed`);
      
      // Уведомляем ConnectionMonitorService об обновлении статуса (Task 2.3)
      this.connectionMonitorService?.updateHeartbeatStatus(
        sessionId,
        true,
        status.lastCheck,
        0,
        undefined,
      );
    } catch (error: any) {
      // Ошибка при проверке
      status.isConnected = false;
      status.consecutiveFailures++;
      status.lastError = error.message;
      status.lastCheck = new Date();
      this.heartbeatStatuses.set(sessionId, status);

      if (status.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.logger.warn(
          `⚠️ Client ${sessionId} heartbeat check failed (${status.consecutiveFailures} consecutive failures): ${error.message}`,
        );
      } else {
        this.logger.debug(
          `Client ${sessionId} heartbeat check failed (attempt ${status.consecutiveFailures}/${this.maxConsecutiveFailures}): ${error.message}`,
        );
      }

      // Уведомляем ConnectionMonitorService об обновлении статуса (Task 2.3)
      this.connectionMonitorService?.updateHeartbeatStatus(
        sessionId,
        false,
        status.lastCheck,
        status.consecutiveFailures,
        error.message,
      );
    }
  }

  /**
   * Получить статус heartbeat для конкретной сессии
   */
  getHeartbeatStatus(sessionId: string): HeartbeatStatus | null {
    return this.heartbeatStatuses.get(sessionId) || null;
  }

  /**
   * Получить статус heartbeat для всех активных сессий
   */
  getAllHeartbeatStatuses(): Map<string, HeartbeatStatus> {
    return new Map(this.heartbeatStatuses);
  }

  /**
   * Очистить статус heartbeat для конкретной сессии
   * Используется при удалении клиента
   */
  clearHeartbeatStatus(sessionId: string): void {
    this.heartbeatStatuses.delete(sessionId);
    this.logger.debug(`Cleared heartbeat status for session ${sessionId}`);
  }
}