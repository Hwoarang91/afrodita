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
  occurrences: Array<{ timestamp: number; context?: unknown }>; // История вхождений для анализа трендов
  baselineCount?: number; // Базовый уровень для сравнения (для FLOOD_WAIT)
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
    const now = Date.now();
    const nowDate = new Date(now);
    const existing = this.metrics.get(errorCode);

    if (existing) {
      existing.count++;
      existing.lastOccurrence = nowDate;
      
      // Сохраняем историю вхождений (ограничиваем до 100 последних для экономии памяти)
      existing.occurrences.push({ timestamp: now, context });
      if (existing.occurrences.length > this.maxOccurrencesPerError) {
        existing.occurrences = existing.occurrences.slice(-this.maxOccurrencesPerError);
      }
    } else {
      this.metrics.set(errorCode, {
        errorCode,
        count: 1,
        firstOccurrence: nowDate,
        lastOccurrence: nowDate,
        occurrences: [{ timestamp: now, context }],
      });
    }

    // Устанавливаем базовый уровень для FLOOD_WAIT (первые 10 минут)
    if (errorCode === ErrorCode.FLOOD_WAIT && !existing?.baselineCount) {
      const tenMinutesAgo = now - 10 * 60 * 1000;
      const recentCount = this.metrics.get(errorCode)?.occurrences.filter(
        (occ) => occ.timestamp > tenMinutesAgo,
      ).length || 0;
      if (recentCount >= 3) {
        // Базовый уровень = среднее за первые 10 минут
        const metric = this.metrics.get(errorCode);
        if (metric) {
          metric.baselineCount = Math.max(1, Math.floor(recentCount / 2));
        }
      }
    }

    // Проверяем canary-алерты
    this.checkCanaryAlerts(errorCode, this.metrics.get(errorCode)!);
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
   * Проверяет canary-алерты для Telegram деградаций
   */
  private checkCanaryAlerts(errorCode: ErrorCode | string, metric: ErrorMetrics): void {
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const thirtyMinutesAgo = now - 30 * 60 * 1000;

    // ============================================================================
    // 🔴 CRITICAL: AUTH_KEY_UNREGISTERED > 0
    // ============================================================================
    // Это означает регрессию в session storage или lifecycle
    if (errorCode === ErrorCode.AUTH_KEY_UNREGISTERED && metric.count > 0) {
      this.logger.error(
        `🔥 CRITICAL ALERT: Обнаружена ошибка AUTH_KEY_UNREGISTERED (count: ${metric.count})! ` +
        `Это может быть регрессия в session storage или lifecycle. ` +
        `Проверьте: DatabaseStorage, saveSession(), getClient().`,
      );
      // TODO: Отправить немедленное уведомление в PagerDuty/Slack
    }

    // ============================================================================
    // 🟡 WARNING: FLOOD_WAIT ↑ x3 за 10 минут
    // ============================================================================
    // Telegram API может быть перегружен или изменились лимиты
    if (errorCode === ErrorCode.FLOOD_WAIT) {
      const recentOccurrences = metric.occurrences.filter(
        (occ) => occ.timestamp > tenMinutesAgo,
      );
      const recentCount = recentOccurrences.length;

      // Базовый уровень (первые 10 минут после старта или если нет истории)
      const baseline = metric.baselineCount || 1;

      if (recentCount >= baseline * 3) {
        this.logger.warn(
          `🚨 ALERT: FLOOD_WAIT резко увеличился! ` +
          `Базовый уровень: ${baseline}, текущий: ${recentCount} за 10 минут (x${(recentCount / baseline).toFixed(1)}). ` +
          `Telegram API может быть перегружен или изменились rate limits.`,
        );
        // TODO: Отправить уведомление в Slack
      }
    }

    // ============================================================================
    // 🟡 WARNING: SESSION_INVALID ↑ после деплоя
    // ============================================================================
    // Может указывать на проблему с session lifecycle или storage
    if (errorCode === ErrorCode.SESSION_INVALID) {
      const recentOccurrences = metric.occurrences.filter(
        (occ) => occ.timestamp > thirtyMinutesAgo,
      );
      const recentCount = recentOccurrences.length;

      // Если после деплоя резко выросло количество SESSION_INVALID
      if (recentCount > 10) {
        this.logger.warn(
          `🚨 ALERT: SESSION_INVALID резко увеличился после деплоя! ` +
          `За последние 30 минут: ${recentCount} ошибок. ` +
          `Проверьте: session lifecycle, DatabaseStorage, getClient().`,
        );
        // TODO: Отправить уведомление в Slack
      }

      // Общий алерт при высоком уровне ошибок
      if (metric.count > 100) {
        this.logger.warn(
          `🚨 ALERT: Высокий уровень ошибок SESSION_INVALID (${metric.count})! ` +
          `Проверьте состояние сессий в базе данных.`,
        );
      }
    }
  }

  /**
   * Периодическая проверка критичных ошибок (вызывается каждые 5 минут)
   */
  private checkCriticalErrors(): void {
    for (const errorCode of CRITICAL_ERROR_CODES) {
      const metrics = this.metrics.get(errorCode);
      if (metrics) {
        this.checkCanaryAlerts(errorCode, metrics);
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

