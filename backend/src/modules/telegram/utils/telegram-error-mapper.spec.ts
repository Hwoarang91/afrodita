/**
 * Тесты для эталонного маппинга Telegram MTProto ошибок → ErrorCode
 * 
 * Проверяет:
 * - 100% покрытие всех типов ошибок
 * - Правильность маппинга ErrorCode → HTTP status
 * - Корректность retryAfter для FLOOD_WAIT
 * - Helper функции (isFatalTelegramError, isRetryableTelegramError)
 */

import { mapTelegramError, mapTelegramErrorToResponse, isFatalTelegramError, isRetryableTelegramError } from './telegram-error-mapper';
import { ErrorCode } from '../../../common/interfaces/error-response.interface';
import { getHttpStatusForErrorCode } from '../../../common/utils/error-code-http-map';

describe('TelegramErrorMapper', () => {
  describe('mapTelegramErrorToResponse', () => {
    it('должен маппить FLOOD_WAIT_X в FLOOD_WAIT с retryAfter', () => {
      const result = mapTelegramErrorToResponse({ message: 'FLOOD_WAIT_42' });
      
      expect(result.errorCode).toBe(ErrorCode.FLOOD_WAIT);
      expect(result.statusCode).toBe(429);
      expect(result.retryAfter).toBe(42);
      expect(result.message).toContain('42 секунд');
    });

    it('должен маппить FLOOD_PREMIUM_WAIT_X в FLOOD_WAIT с retryAfter', () => {
      const result = mapTelegramError({ message: 'FLOOD_PREMIUM_WAIT_60' });
      
      expect(result.errorCode).toBe(ErrorCode.FLOOD_WAIT);
      expect(result.statusCode).toBe(429);
      expect(result.retryAfter).toBe(60);
    });

    it('должен маппить PHONE_CODE_INVALID в PHONE_CODE_INVALID', () => {
      const result = mapTelegramError({ message: 'PHONE_CODE_INVALID' });
      
      expect(result.errorCode).toBe(ErrorCode.PHONE_CODE_INVALID);
      expect(result.statusCode).toBe(400);
      expect(result.message).toContain('Неверный код');
    });

    it('должен маппить PHONE_CODE_EXPIRED в PHONE_CODE_EXPIRED', () => {
      const result = mapTelegramError({ message: 'PHONE_CODE_EXPIRED' });
      
      expect(result.errorCode).toBe(ErrorCode.PHONE_CODE_EXPIRED);
      expect(result.statusCode).toBe(400);
      expect(result.message).toContain('истёк');
    });

    it('должен маппить PHONE_NUMBER_INVALID в PHONE_NUMBER_INVALID', () => {
      const result = mapTelegramError({ message: 'PHONE_NUMBER_INVALID' });
      
      expect(result.errorCode).toBe(ErrorCode.PHONE_NUMBER_INVALID);
      expect(result.statusCode).toBe(400);
    });

    it('должен маппить PHONE_NUMBER_FLOOD в TOO_MANY_REQUESTS', () => {
      const result = mapTelegramError({ message: 'PHONE_NUMBER_FLOOD' });
      
      expect(result.errorCode).toBe(ErrorCode.TOO_MANY_REQUESTS);
      expect(result.statusCode).toBe(429);
    });

    it('должен маппить PASSWORD_HASH_INVALID в INVALID_2FA_PASSWORD', () => {
      const result = mapTelegramError({ message: 'PASSWORD_HASH_INVALID' });
      
      expect(result.errorCode).toBe(ErrorCode.INVALID_2FA_PASSWORD);
      expect(result.statusCode).toBe(401);
    });

    it('должен маппить SESSION_PASSWORD_NEEDED в INVALID_2FA_PASSWORD', () => {
      const result = mapTelegramError({ message: 'SESSION_PASSWORD_NEEDED' });
      
      expect(result.errorCode).toBe(ErrorCode.INVALID_2FA_PASSWORD);
      expect(result.statusCode).toBe(401);
    });

    it('должен маппить SRP_PASSWORD_CHANGED в INVALID_2FA_PASSWORD', () => {
      const result = mapTelegramError({ message: 'SRP_PASSWORD_CHANGED' });
      
      expect(result.errorCode).toBe(ErrorCode.INVALID_2FA_PASSWORD);
      expect(result.statusCode).toBe(401);
      expect(result.message).toContain('изменён');
    });

    it('должен маппить AUTH_KEY_UNREGISTERED в SESSION_INVALID', () => {
      const result = mapTelegramError({ message: 'AUTH_KEY_UNREGISTERED' });
      
      expect(result.errorCode).toBe(ErrorCode.SESSION_INVALID);
      expect(result.statusCode).toBe(401);
    });

    it('должен маппить SESSION_REVOKED в SESSION_INVALID', () => {
      const result = mapTelegramError({ message: 'SESSION_REVOKED' });
      
      expect(result.errorCode).toBe(ErrorCode.SESSION_INVALID);
      expect(result.statusCode).toBe(401);
    });

    it('должен маппить AUTH_KEY_DUPLICATED в SESSION_INVALID', () => {
      const result = mapTelegramError({ message: 'AUTH_KEY_DUPLICATED' });
      
      expect(result.errorCode).toBe(ErrorCode.SESSION_INVALID);
      expect(result.statusCode).toBe(401);
    });

    it('должен маппить AUTH_RESTART в SESSION_INVALID', () => {
      const result = mapTelegramError({ message: 'AUTH_RESTART' });
      
      expect(result.errorCode).toBe(ErrorCode.SESSION_INVALID);
      expect(result.statusCode).toBe(401);
    });

    it('должен маппить USER_DEACTIVATED в SESSION_INVALID', () => {
      const result = mapTelegramError({ message: 'USER_DEACTIVATED' });
      
      expect(result.errorCode).toBe(ErrorCode.SESSION_INVALID);
      expect(result.statusCode).toBe(401);
    });

    it('должен маппить USER_DEACTIVATED_BAN в SESSION_INVALID', () => {
      const result = mapTelegramError({ message: 'USER_DEACTIVATED_BAN' });
      
      expect(result.errorCode).toBe(ErrorCode.SESSION_INVALID);
      expect(result.statusCode).toBe(401);
    });

    it('должен маппить PHONE_NUMBER_BANNED в PHONE_NUMBER_BANNED', () => {
      const result = mapTelegramError({ message: 'PHONE_NUMBER_BANNED' });
      
      expect(result.errorCode).toBe(ErrorCode.PHONE_NUMBER_BANNED);
      expect(result.statusCode).toBe(403);
    });

    it('должен маппить DC_MIGRATE_X в DC_MIGRATE с номером DC', () => {
      const result = mapTelegramError({ message: 'DC_MIGRATE_2' });
      
      expect(result.errorCode).toBe(ErrorCode.DC_MIGRATE);
      expect(result.statusCode).toBe(409);
      expect(result.message).toContain('дата-центр 2');
    });

    it('должен маппить NETWORK_MIGRATE_X в DC_MIGRATE', () => {
      const result = mapTelegramError({ message: 'NETWORK_MIGRATE_3' });
      
      expect(result.errorCode).toBe(ErrorCode.DC_MIGRATE);
      expect(result.statusCode).toBe(409);
    });

    it('должен маппить FILE_MIGRATE_X в DC_MIGRATE', () => {
      const result = mapTelegramError({ message: 'FILE_MIGRATE_4' });
      
      expect(result.errorCode).toBe(ErrorCode.DC_MIGRATE);
      expect(result.statusCode).toBe(409);
    });

    it('должен маппить PHONE_MIGRATE_X в DC_MIGRATE', () => {
      const result = mapTelegramError({ message: 'PHONE_MIGRATE_5' });
      
      expect(result.errorCode).toBe(ErrorCode.DC_MIGRATE);
      expect(result.statusCode).toBe(409);
    });

    it('должен маппить USER_MIGRATE_X в DC_MIGRATE', () => {
      const result = mapTelegramError({ message: 'USER_MIGRATE_1' });
      
      expect(result.errorCode).toBe(ErrorCode.DC_MIGRATE);
      expect(result.statusCode).toBe(409);
    });

    it('должен маппить MSG_WAIT_FAILED в RETRY', () => {
      const result = mapTelegramError({ message: 'MSG_WAIT_FAILED' });
      
      expect(result.errorCode).toBe(ErrorCode.RETRY);
      expect(result.statusCode).toBe(409);
    });

    it('должен маппить RPC_CALL_FAIL в INTERNAL_SERVER_ERROR', () => {
      const result = mapTelegramError({ message: 'RPC_CALL_FAIL' });
      
      expect(result.errorCode).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(result.statusCode).toBe(500);
    });

    it('должен маппить TIMEOUT в TIMEOUT', () => {
      const result = mapTelegramError({ message: 'TIMEOUT' });
      
      expect(result.errorCode).toBe(ErrorCode.TIMEOUT);
      expect(result.statusCode).toBe(504);
    });

    it('должен маппить CONNECTION_NOT_INITED в INTERNAL_SERVER_ERROR', () => {
      const result = mapTelegramError({ message: 'CONNECTION_NOT_INITED' });
      
      expect(result.errorCode).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(result.statusCode).toBe(500);
    });

    it('должен маппить INTERNAL_SERVER_ERROR в INTERNAL_SERVER_ERROR', () => {
      const result = mapTelegramError({ message: 'INTERNAL_SERVER_ERROR' });
      
      expect(result.errorCode).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(result.statusCode).toBe(500);
    });

    it('должен маппить неизвестную ошибку в INTERNAL_SERVER_ERROR', () => {
      const result = mapTelegramError({ message: 'UNKNOWN_ERROR_12345' });
      
      expect(result.errorCode).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
      expect(result.statusCode).toBe(500);
      expect(result.message).toContain('Неизвестная ошибка Telegram');
    });

    it('должен обрабатывать ошибку как строку', () => {
      const result = mapTelegramError('PHONE_CODE_INVALID');
      
      expect(result.errorCode).toBe(ErrorCode.PHONE_CODE_INVALID);
    });

    it('должен обрабатывать ошибку с errorMessage', () => {
      const result = mapTelegramError({ errorMessage: 'FLOOD_WAIT_30' });
      
      expect(result.errorCode).toBe(ErrorCode.FLOOD_WAIT);
      expect(result.retryAfter).toBe(30);
    });

    it('должен обрабатывать null/undefined ошибку', () => {
      const result = mapTelegramError(null);
      
      expect(result.errorCode).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    });
  });


  describe('isFatalTelegramError', () => {
    it('должен возвращать true для AUTH_KEY_UNREGISTERED', () => {
      expect(isFatalTelegramError({ message: 'AUTH_KEY_UNREGISTERED' })).toBe(true);
    });

    it('должен возвращать true для SESSION_REVOKED', () => {
      expect(isFatalTelegramError({ message: 'SESSION_REVOKED' })).toBe(true);
    });

    it('должен возвращать true для USER_DEACTIVATED', () => {
      expect(isFatalTelegramError({ message: 'USER_DEACTIVATED' })).toBe(true);
    });

    it('должен возвращать false для PHONE_CODE_INVALID', () => {
      expect(isFatalTelegramError({ message: 'PHONE_CODE_INVALID' })).toBe(false);
    });

    it('должен возвращать false для FLOOD_WAIT', () => {
      expect(isFatalTelegramError({ message: 'FLOOD_WAIT_10' })).toBe(false);
    });
  });

  describe('isRetryableTelegramError', () => {
    it('должен возвращать true для FLOOD_WAIT', () => {
      expect(isRetryableTelegramError({ message: 'FLOOD_WAIT_10' })).toBe(true);
    });

    it('должен возвращать true для DC_MIGRATE', () => {
      expect(isRetryableTelegramError({ message: 'DC_MIGRATE_2' })).toBe(true);
    });

    it('должен возвращать true для RETRY', () => {
      expect(isRetryableTelegramError({ message: 'MSG_WAIT_FAILED' })).toBe(true);
    });

    it('должен возвращать true для TIMEOUT', () => {
      expect(isRetryableTelegramError({ message: 'TIMEOUT' })).toBe(true);
    });

    it('должен возвращать true для INTERNAL_SERVER_ERROR', () => {
      expect(isRetryableTelegramError({ message: 'RPC_CALL_FAIL' })).toBe(true);
    });

    it('должен возвращать false для PHONE_CODE_INVALID', () => {
      expect(isRetryableTelegramError({ message: 'PHONE_CODE_INVALID' })).toBe(false);
    });

    it('должен возвращать false для SESSION_INVALID', () => {
      expect(isRetryableTelegramError({ message: 'AUTH_KEY_UNREGISTERED' })).toBe(false);
    });
  });

  describe('Принципы архитектуры', () => {
    it('должен использовать ERROR_HTTP_MAP для всех статусов', () => {
      const testCases = [
        { message: 'FLOOD_WAIT_10', expectedStatus: getHttpStatusForErrorCode(ErrorCode.FLOOD_WAIT) },
        { message: 'PHONE_CODE_INVALID', expectedStatus: getHttpStatusForErrorCode(ErrorCode.PHONE_CODE_INVALID) },
        { message: 'SESSION_REVOKED', expectedStatus: getHttpStatusForErrorCode(ErrorCode.SESSION_INVALID) },
        { message: 'DC_MIGRATE_2', expectedStatus: getHttpStatusForErrorCode(ErrorCode.DC_MIGRATE) },
      ];

      testCases.forEach(({ message, expectedStatus }) => {
        const result = mapTelegramError({ message });
        expect(result.statusCode).toBe(expectedStatus);
      });
    });

    it('должен возвращать строку message (не объект и не массив)', () => {
      const result = mapTelegramError({ message: 'PHONE_CODE_INVALID' });
      
      expect(typeof result.message).toBe('string');
      expect(Array.isArray(result.message)).toBe(false);
      expect(typeof result.message).not.toBe('object');
    });
  });
});

