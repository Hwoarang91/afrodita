/**
 * Rate limiting по ErrorCode
 * 
 * Ограничивает количество попыток для критичных ошибок:
 * - INVALID_2FA_PASSWORD → max 5 / 10 мин
 * - PHONE_CODE_INVALID → max 3 / 5 мин
 * - FLOOD_WAIT → блок UI до retryAfter
 * 
 * Использование:
 * ```typescript
 * @UseInterceptors(ErrorCodeRateLimitInterceptor)
 * ```
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorCode } from '../interfaces/error-response.interface';
import { buildErrorResponse } from '../utils/error-response.builder';

/**
 * Конфигурация rate limiting для каждого ErrorCode
 */
interface ErrorCodeRateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Окно времени в миллисекундах
}

const ERROR_CODE_RATE_LIMITS: Partial<Record<ErrorCode, ErrorCodeRateLimitConfig>> = {
  [ErrorCode.INVALID_2FA_PASSWORD]: {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 минут
  },
  [ErrorCode.PHONE_CODE_INVALID]: {
    maxAttempts: 3,
    windowMs: 5 * 60 * 1000, // 5 минут
  },
};

/**
 * In-memory хранилище попыток (для production лучше использовать Redis)
 */
class ErrorCodeAttemptStore {
  private attempts: Map<string, number[]> = new Map();

  /**
   * Генерирует ключ для хранения попыток
   */
  private getKey(errorCode: ErrorCode, identifier: string): string {
    return `${errorCode}:${identifier}`;
  }

  /**
   * Регистрирует попытку
   */
  recordAttempt(errorCode: ErrorCode, identifier: string): void {
    const key = this.getKey(errorCode, identifier);
    const now = Date.now();
    const config = ERROR_CODE_RATE_LIMITS[errorCode];
    
    if (!config) return;

    const attempts = this.attempts.get(key) || [];
    const windowStart = now - config.windowMs;
    
    // Удаляем старые попытки вне окна
    const recentAttempts = attempts.filter(timestamp => timestamp > windowStart);
    recentAttempts.push(now);
    
    this.attempts.set(key, recentAttempts);
  }

  /**
   * Проверяет, превышен ли лимит
   */
  isLimitExceeded(errorCode: ErrorCode, identifier: string): boolean {
    const config = ERROR_CODE_RATE_LIMITS[errorCode];
    if (!config) return false;

    const key = this.getKey(errorCode, identifier);
    const attempts = this.attempts.get(key) || [];
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    const recentAttempts = attempts.filter(timestamp => timestamp > windowStart);
    return recentAttempts.length >= config.maxAttempts;
  }

  /**
   * Получает время до следующей попытки (в секундах)
   */
  getRetryAfter(errorCode: ErrorCode, identifier: string): number | null {
    const config = ERROR_CODE_RATE_LIMITS[errorCode];
    if (!config) return null;

    const key = this.getKey(errorCode, identifier);
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return null;

    const oldestAttempt = Math.min(...attempts);
    const windowEnd = oldestAttempt + config.windowMs;
    const now = Date.now();
    
    if (windowEnd > now) {
      return Math.ceil((windowEnd - now) / 1000);
    }
    
    return null;
  }

  /**
   * Очищает попытки для идентификатора
   */
  clearAttempts(errorCode: ErrorCode, identifier: string): void {
    const key = this.getKey(errorCode, identifier);
    this.attempts.delete(key);
  }
}

const attemptStore = new ErrorCodeAttemptStore();

@Injectable()
export class ErrorCodeRateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorCodeRateLimitInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // Получаем идентификатор (IP или userId)
    const identifier = request.user?.id || request.ip || 'unknown';

    return next.handle().pipe(
      catchError((error) => {
        // Проверяем, является ли ошибка ErrorResponse с ErrorCode
        const errorResponse = error?.response?.data || error?.response;
        const errorCode = errorResponse?.errorCode;

        if (errorCode && errorCode in ERROR_CODE_RATE_LIMITS) {
          // Регистрируем попытку
          attemptStore.recordAttempt(errorCode as ErrorCode, identifier);

          // Проверяем лимит
          if (attemptStore.isLimitExceeded(errorCode as ErrorCode, identifier)) {
            const retryAfter = attemptStore.getRetryAfter(errorCode as ErrorCode, identifier);
            
            this.logger.warn(
              `Rate limit exceeded for ${errorCode} (${identifier}). Retry after ${retryAfter}s`,
            );

            const rateLimitError = buildErrorResponse(
              429,
              ErrorCode.TOO_MANY_REQUESTS,
              `Превышен лимит попыток. Повторите через ${retryAfter || 60} секунд.`,
              undefined,
              retryAfter || 60,
            );

            return throwError(() => new HttpException(rateLimitError, 429));
          }
        }

        return throwError(() => error);
      }),
    );
  }
}

/**
 * Проверяет rate limit для конкретного ErrorCode и идентификатора
 * Используется в контроллерах для явной проверки
 */
export function checkErrorCodeRateLimit(
  errorCode: ErrorCode,
  identifier: string,
): { allowed: boolean; retryAfter?: number } {
  if (attemptStore.isLimitExceeded(errorCode, identifier)) {
    const retryAfter = attemptStore.getRetryAfter(errorCode, identifier);
    return { allowed: false, retryAfter: retryAfter || undefined };
  }
  return { allowed: true };
}

