import {
  mapTelegramError,
  mapTelegramErrorToResponse,
  isFatalTelegramError,
  isRetryableTelegramError,
  isRequire2faActionError,
} from './telegram-error-mapper';

describe('telegram-error-mapper', () => {
  describe('mapTelegramError', () => {
    it('маппит FLOOD_WAIT_42', () => {
      const r = mapTelegramError({ message: 'FLOOD_WAIT_42' });
      expect(r.statusCode).toBe(429);
      expect(r.errorCode).toBe('FLOOD_WAIT');
      expect(r.message).toContain('42');
      expect(r.retryAfter).toBe(42);
    });

    it('маппит PHONE_CODE_INVALID', () => {
      const r = mapTelegramError({ message: 'PHONE_CODE_INVALID' });
      expect(r.statusCode).toBe(400);
      expect(r.errorCode).toBe('PHONE_CODE_INVALID');
      expect(r.message).toContain('Неверный код');
    });

    it('маппит PHONE_CODE_EXPIRED', () => {
      const r = mapTelegramError({ message: 'PHONE_CODE_EXPIRED' });
      expect(r.errorCode).toBe('PHONE_CODE_EXPIRED');
    });

    it('маппит AUTH_KEY_UNREGISTERED', () => {
      const r = mapTelegramError({ message: 'AUTH_KEY_UNREGISTERED' });
      expect(r.errorCode).toBe('SESSION_INVALID');
      expect(r.message).toContain('недействительна');
    });

    it('маппит SESSION_REVOKED', () => {
      const r = mapTelegramError({ message: 'SESSION_REVOKED' });
      expect(r.errorCode).toBe('SESSION_INVALID');
    });

    it('маппит DC_MIGRATE_2', () => {
      const r = mapTelegramError({ message: 'DC_MIGRATE_2' });
      expect(r.errorCode).toBe('DC_MIGRATE');
      expect(r.message).toContain('2');
    });

    it('маппит PASSWORD_HASH_INVALID как INVALID_2FA_PASSWORD', () => {
      const r = mapTelegramError({ message: 'PASSWORD_HASH_INVALID' });
      expect(r.errorCode).toBe('INVALID_2FA_PASSWORD');
    });

    it('возвращает 500 для неизвестной ошибки', () => {
      const r = mapTelegramError({ message: 'SOME_UNKNOWN_ERROR' });
      expect(r.statusCode).toBe(500);
      expect(r.errorCode).toBe('INTERNAL_SERVER_ERROR');
    });

    it('обрабатывает errorMessage', () => {
      const r = mapTelegramError({ errorMessage: 'PHONE_CODE_EXPIRED' });
      expect(r.errorCode).toBe('PHONE_CODE_EXPIRED');
    });

    it('обрабатывает null/undefined', () => {
      const r = mapTelegramError(null);
      expect(r.statusCode).toBe(500);
    });
  });

  describe('mapTelegramErrorToResponse', () => {
    it('возвращает ErrorResponse с retryAfter для FLOOD_WAIT', () => {
      const res = mapTelegramErrorToResponse({ message: 'FLOOD_WAIT_5' });
      expect(res.statusCode).toBe(429);
      expect(res.errorCode).toBe('FLOOD_WAIT');
      expect(res.retryAfter).toBe(5);
      expect(res.message).toBeDefined();
    });
  });

  describe('isFatalTelegramError', () => {
    it('true для SESSION_REVOKED', () => {
      expect(isFatalTelegramError({ message: 'SESSION_REVOKED' })).toBe(true);
    });
    it('true для AUTH_KEY_UNREGISTERED', () => {
      expect(isFatalTelegramError({ message: 'AUTH_KEY_UNREGISTERED' })).toBe(true);
    });
    it('false для PHONE_CODE_INVALID', () => {
      expect(isFatalTelegramError({ message: 'PHONE_CODE_INVALID' })).toBe(false);
    });
  });

  describe('isRetryableTelegramError', () => {
    it('true для FLOOD_WAIT', () => {
      expect(isRetryableTelegramError({ message: 'FLOOD_WAIT_1' })).toBe(true);
    });
    it('true для DC_MIGRATE', () => {
      expect(isRetryableTelegramError({ message: 'DC_MIGRATE_2' })).toBe(true);
    });
    it('true для INTERNAL_SERVER_ERROR', () => {
      expect(isRetryableTelegramError({ message: 'INTERNAL_SERVER_ERROR' })).toBe(true);
    });
    it('false для SESSION_REVOKED', () => {
      expect(isRetryableTelegramError({ message: 'SESSION_REVOKED' })).toBe(false);
    });
  });

  describe('isRequire2faActionError', () => {
    it('true для PASSWORD_HASH_INVALID', () => {
      expect(isRequire2faActionError({ message: 'PASSWORD_HASH_INVALID' })).toBe(true);
    });
    it('true для PHONE_CODE_EXPIRED', () => {
      expect(isRequire2faActionError({ message: 'PHONE_CODE_EXPIRED' })).toBe(true);
    });
    it('false для SESSION_REVOKED', () => {
      expect(isRequire2faActionError({ message: 'SESSION_REVOKED' })).toBe(false);
    });
  });
});
