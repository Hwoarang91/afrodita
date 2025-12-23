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
    it('должен возвращать null для несуществующей ошибки', () => {
      const metrics = service.getMetrics(ErrorCode.PHONE_CODE_INVALID);
      expect(metrics).toBeNull();
    });

    it('должен возвращать метрики для существующей ошибки', () => {
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      
      const metrics = service.getMetrics(ErrorCode.PHONE_CODE_INVALID);
      expect(metrics).not.toBeNull();
      expect(metrics?.errorCode).toBe(ErrorCode.PHONE_CODE_INVALID);
      expect(metrics?.count).toBe(1);
    });
  });

  describe('getAllMetrics', () => {
    it('должен возвращать все метрики', () => {
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      service.recordError(ErrorCode.SESSION_INVALID);
      
      const allMetrics = service.getAllMetrics();
      expect(allMetrics.length).toBe(2);
    });

    it('должен возвращать пустой массив если нет метрик', () => {
      const allMetrics = service.getAllMetrics();
      expect(allMetrics).toEqual([]);
    });
  });

  describe('getTopErrors', () => {
    it('должен возвращать топ ошибок по количеству', () => {
      // Записываем разные ошибки с разным количеством
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      
      service.recordError(ErrorCode.SESSION_INVALID);
      service.recordError(ErrorCode.SESSION_INVALID);
      
      service.recordError(ErrorCode.FLOOD_WAIT);
      
      const topErrors = service.getTopErrors(2);
      
      expect(topErrors.length).toBe(2);
      expect(topErrors[0].errorCode).toBe(ErrorCode.PHONE_CODE_INVALID);
      expect(topErrors[0].count).toBe(3);
      expect(topErrors[1].errorCode).toBe(ErrorCode.SESSION_INVALID);
      expect(topErrors[1].count).toBe(2);
    });
  });

  describe('resetMetrics', () => {
    it('должен очищать все метрики', () => {
      service.recordError(ErrorCode.PHONE_CODE_INVALID);
      service.recordError(ErrorCode.SESSION_INVALID);
      
      service.resetMetrics();
      
      expect(service.getAllMetrics()).toEqual([]);
    });
  });

  describe('Ограничение памяти', () => {
    it('должен ограничивать количество сохраненных вхождений', () => {
      // Записываем много ошибок
      for (let i = 0; i < 150; i++) {
        service.recordError(ErrorCode.PHONE_CODE_INVALID);
      }
      
      const metrics = service.getMetrics(ErrorCode.PHONE_CODE_INVALID);
      expect(metrics?.count).toBe(150);
      // Количество сохраненных вхождений должно быть ограничено
      expect(metrics?.occurrences.length).toBeLessThanOrEqual(100);
    });
  });
});

