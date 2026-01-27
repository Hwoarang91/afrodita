import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { buildErrorResponse } from '../utils/error-response.builder';
import { ErrorCode } from '../interfaces/error-response.interface';

/** Исключение при открытом контуре (сервис временно недоступен). Пробрасывать в контроллер для 503. */
export class CircuitOpenException extends HttpException {
  constructor(serviceKey: string) {
    super(
      buildErrorResponse(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Сервис временно недоступен. Попробуйте через 1–2 минуты.',
      ),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export interface CircuitBreakerOptions {
  /** Порог сбоев для перехода в OPEN (по умолчанию 5) */
  failureThreshold?: number;
  /** Время в ms до перехода OPEN → HALF_OPEN (по умолчанию 30000) */
  resetTimeoutMs?: number;
}

interface Circuit {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: number;
  lastStateChange: number;
}

/**
 * Простой in-memory circuit breaker для внешних сервисов (§17).
 * При OPEN возвращает 503 (CircuitOpenException) без вызова fn.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly circuits = new Map<string, Circuit>();
  private readonly defaultThreshold: number;
  private readonly defaultResetMs: number;

  constructor(options?: CircuitBreakerOptions) {
    this.defaultThreshold = options?.failureThreshold ?? 5;
    this.defaultResetMs = options?.resetTimeoutMs ?? 30000;
  }

  async run<T>(key: string, fn: () => Promise<T>, options?: CircuitBreakerOptions): Promise<T> {
    const circuit = this.getOrCreate(key);
    const threshold = options?.failureThreshold ?? this.defaultThreshold;
    const resetMs = options?.resetTimeoutMs ?? this.defaultResetMs;

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastStateChange >= resetMs) {
        circuit.state = 'HALF_OPEN';
        circuit.lastStateChange = Date.now();
      } else {
        throw new CircuitOpenException(key);
      }
    }

    try {
      const result = await fn();
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        circuit.lastStateChange = Date.now();
      }
      return result;
    } catch (e: unknown) {
      circuit.failures++;
      circuit.lastFailureTime = Date.now();
      if (circuit.state === 'HALF_OPEN' || circuit.failures >= threshold) {
        circuit.state = 'OPEN';
        circuit.lastStateChange = Date.now();
      }
      throw e;
    }
  }

  private getOrCreate(key: string): Circuit {
    let c = this.circuits.get(key);
    if (!c) {
      c = { state: 'CLOSED', failures: 0, lastFailureTime: 0, lastStateChange: 0 };
      this.circuits.set(key, c);
    }
    return c!;
  }
}
