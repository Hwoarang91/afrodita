/**
 * Метрики по ErrorCode
 * 
 * Собирает статистику ошибок по errorCode для мониторинга и алертов
 * 
 * Метрики:
 * - Счётчик ошибок по errorCode
 * - Алерты для критичных ошибок (SESSION_INVALID, AUTH_KEY_UNREGISTERED)
 * - Тренды ошибок
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ErrorCode } from '../interfaces/error-response.interface';

interface ErrorMetrics {
  errorCode: ErrorCode | string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  occurrences: Date[];
}

/**
 * Критичные ошибки, требующие немедленного внимания
 */
const CRITICAL_ERROR_CODES: ErrorCode[] = [
  ErrorCode.SESSION_INVALID,
  ErrorCode.AUTH_KEY_UNREGISTERED,
];

@Injectable()
export class ErrorMetricsService implements OnModuleInit {
  private readonly logger = new Logger(ErrorMetricsService.name);
  private metrics: Map<ErrorCode | string, ErrorMetrics> = new Map();
  private readonly maxOccurrencesPerError = 100; // Ограничение памяти

  onModuleInit() {
    this.logger.log('✅ ErrorMetricsService инициализирован');
    
    // Периодическая проверка критичных ошибок (каждые 5 минут)
    setInterval(() => {
      this.checkCriticalErrors();
    }, 5 * 60 * 1000);
  }

  /**
   * Регистрирует ошибку для метрик
   * 
   * @param errorCode - Код ошибки
   * @param context - Дополнительный контекст (sessionId, userId и т.д.)
   */
  recordError(errorCode: ErrorCode | string, context?: Record<string, any>): void {
    const now = new Date();
    const existing = this.metrics.get(errorCode);

    if (existing) {
      existing.count++;
      existing.lastOccurrence = now;
      
      // Ограничиваем количество сохраненных вхождений
      if (existing.occurrences.length < this.maxOccurrencesPerError) {
        existing.occurrences.push(now);
      }
    } else {
      this.metrics.set(errorCode, {
        errorCode,
        count: 1,
        firstOccurrence: now,
        lastOccurrence: now,
        occurrences: [now],
      });
    }

    // Логируем критичные ошибки немедленно
    if (CRITICAL_ERROR_CODES.includes(errorCode as ErrorCode)) {
      this.logger.error(
        `[CRITICAL ERROR] ${errorCode} detected`,
        context ? { context } : undefined,
      );
    }
  }

  /**
   * Получает метрики для ErrorCode
   */
  getMetrics(errorCode: ErrorCode | string): ErrorMetrics | null {
    return this.metrics.get(errorCode) || null;
  }

  /**
   * Получает все метрики
   */
  getAllMetrics(): ErrorMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Получает топ ошибок по количеству
   */
  getTopErrors(limit: number = 10): ErrorMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Проверяет критичные ошибки и отправляет алерты
   */
  private checkCriticalErrors(): void {
    for (const errorCode of CRITICAL_ERROR_CODES) {
      const metrics = this.metrics.get(errorCode);
      
      if (metrics) {
        // Алерт если SESSION_INVALID резко вырос (более 10 за последний час)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCount = metrics.occurrences.filter(
          date => date > oneHourAgo,
        ).length;

        if (recentCount > 10) {
          this.logger.warn(
            `[ALERT] ${errorCode} резко вырос: ${recentCount} ошибок за последний час`,
          );
        }

        // Алерт если AUTH_KEY_UNREGISTERED > 0 (регрессия)
        if (errorCode === ErrorCode.AUTH_KEY_UNREGISTERED && metrics.count > 0) {
          this.logger.error(
            `[ALERT] AUTH_KEY_UNREGISTERED detected (${metrics.count} total). Это указывает на регрессию в сохранении сессий!`,
          );
        }
      }
    }
  }

  /**
   * Сбрасывает метрики (для тестов или периодической очистки)
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.logger.log('Метрики ошибок сброшены');
  }
}

