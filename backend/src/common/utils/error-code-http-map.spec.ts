/**
 * Тесты для типизации ErrorCode → HTTP status
 * 
 * Проверяет:
 * - Все ErrorCode имеют соответствующий HTTP статус
 * - getHttpStatusForErrorCode работает корректно
 * - Fallback для неизвестных кодов
 */

import { ErrorCode } from '../interfaces/error-response.interface';
import { ERROR_HTTP_MAP, getHttpStatusForErrorCode } from './error-code-http-map';

describe('ErrorCodeHttpMap', () => {
  describe('ERROR_HTTP_MAP', () => {
    it('должен содержать все ErrorCode', () => {
      const allErrorCodes = Object.values(ErrorCode);
      
      allErrorCodes.forEach((errorCode) => {
        expect(ERROR_HTTP_MAP).toHaveProperty(errorCode);
        expect(typeof ERROR_HTTP_MAP[errorCode]).toBe('number');
        expect(ERROR_HTTP_MAP[errorCode]).toBeGreaterThanOrEqual(400);
        expect(ERROR_HTTP_MAP[errorCode]).toBeLessThanOrEqual(599);
      });
    });

    it('должен маппить VALIDATION_ERROR в 400', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.VALIDATION_ERROR]).toBe(400);
    });

    it('должен маппить UNAUTHORIZED в 401', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.UNAUTHORIZED]).toBe(401);
    });

    it('должен маппить SESSION_INVALID в 401', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.SESSION_INVALID]).toBe(401);
    });

    it('должен маппить PHONE_NUMBER_BANNED в 403', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.PHONE_NUMBER_BANNED]).toBe(403);
    });

    it('должен маппить NOT_FOUND в 404', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.NOT_FOUND]).toBe(404);
    });

    it('должен маппить DC_MIGRATE в 409', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.DC_MIGRATE]).toBe(409);
    });

    it('должен маппить FLOOD_WAIT в 429', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.FLOOD_WAIT]).toBe(429);
    });

    it('должен маппить INTERNAL_SERVER_ERROR в 500', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.INTERNAL_SERVER_ERROR]).toBe(500);
    });

    it('должен маппить TIMEOUT в 504', () => {
      expect(ERROR_HTTP_MAP[ErrorCode.TIMEOUT]).toBe(504);
    });
  });

  describe('getHttpStatusForErrorCode', () => {
    it('должен возвращать правильный статус для известного ErrorCode', () => {
      expect(getHttpStatusForErrorCode(ErrorCode.FLOOD_WAIT)).toBe(429);
      expect(getHttpStatusForErrorCode(ErrorCode.SESSION_INVALID)).toBe(401);
      expect(getHttpStatusForErrorCode(ErrorCode.NOT_FOUND)).toBe(404);
    });

    it('должен возвращать 500 для неизвестного ErrorCode', () => {
      expect(getHttpStatusForErrorCode('UNKNOWN_ERROR' as ErrorCode)).toBe(500);
    });

    it('должен возвращать 500 для пустой строки', () => {
      expect(getHttpStatusForErrorCode('')).toBe(500);
    });
  });
});

