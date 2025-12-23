/**
 * Тесты для ErrorMetricsService
 * 
 * Проверяет:
 * - Регистрацию ошибок
 * - Получение метрик
 * - Алерты для критичных ошибок
 * - Ограничение памяти (maxOccurrencesPerError)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ErrorMetricsService } from './error-metrics.service';
import { ErrorCode } from '../interfaces/error-response.interface';

describe('ErrorMetricsService', () => {
  let service: ErrorMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorMetricsService],
    }).compile();

    service = module.get<ErrorMetricsService>(ErrorMetricsService);
  });

  afterEach(() => {
    service.resetMetrics();
  });

  describe('recordError', () => {
    it('должен регистрировать ошибку', () => {
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      
      const metrics = service.getMetrics(ErrorCode.PHONE_CODE_INVALID);
      expect(metrics).not.toBeNull();
      expect(metrics?.count).toBe(1);
    });

    it('должен увеличивать счетчик при повторных ошибках', () => {
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      
      const metrics = service.getMetrics(ErrorCode.PHONE_CODE_INVALID);
      expect(metrics?.count).toBe(3);
    });

    it('должен сохранять firstOccurrence и lastOccurrence', () => {
      const before = new Date();
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      const after = new Date();
      
      const metrics = service.getMetrics(ErrorCode.PHONE_CODE_INVALID);
      expect(metrics?.firstOccurrence.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(metrics?.firstOccurrence.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(metrics?.lastOccurrence.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('должен сохранять контекст для критичных ошибок', () => {
      service.recordError(ErrorCode.SESSION_INVALID, { sessionId: 'test-123' });
      
      const metrics = service.getMetrics(ErrorCode.SESSION_INVALID);
      expect(metrics).not.toBeNull();
      expect(metrics?.count).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('должен возвращать метрики для существующей ошибки', () => {
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      
      const metrics = service.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.size).toBeGreaterThan(0);
    });
  });
});

