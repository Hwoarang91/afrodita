/**
 * Тесты для маскирования sensitive данных
 * 
 * Проверяет:
 * - Маскирование phoneNumber, sessionId, password, email
 * - maskSensitiveData для объектов
 * - Обработка null/undefined
 */

import {
  maskPhoneNumber,
  maskSessionId,
  maskPassword,
  maskEmail,
  maskSensitiveData,
} from './sensitive-data-masker';

describe('SensitiveDataMasker', () => {
  describe('maskPhoneNumber', () => {
    it('должен маскировать номер телефона', () => {
      expect(maskPhoneNumber('+79377281319')).toBe('+79*****319');
    });

    it('должен обрабатывать короткие номера', () => {
      expect(maskPhoneNumber('123')).toBe('***');
    });

    it('должен обрабатывать null', () => {
      expect(maskPhoneNumber(null)).toBe('***');
    });

    it('должен обрабатывать undefined', () => {
      expect(maskPhoneNumber(undefined)).toBe('***');
    });

    it('должен обрабатывать номера с пробелами', () => {
      expect(maskPhoneNumber('+7 937 728 13 19')).toBe('+79*****319');
    });
  });

  describe('maskSessionId', () => {
    it('должен маскировать sessionId (показывать первые 8 символов)', () => {
      expect(maskSessionId('1234567890abcdef')).toBe('12345678...');
    });

    it('должен возвращать *** для коротких ID', () => {
      expect(maskSessionId('123')).toBe('***');
    });

    it('должен обрабатывать null', () => {
      expect(maskSessionId(null)).toBe('***');
    });

    it('должен обрабатывать undefined', () => {
      expect(maskSessionId(undefined)).toBe('***');
    });
  });

  describe('maskPassword', () => {
    it('должен всегда возвращать ***', () => {
      expect(maskPassword('secret123')).toBe('***');
      expect(maskPassword('')).toBe('***');
      expect(maskPassword(null)).toBe('***');
      expect(maskPassword(undefined)).toBe('***');
    });
  });

  describe('maskEmail', () => {
    it('должен маскировать email (показывать только домен)', () => {
      expect(maskEmail('user@example.com')).toBe('***@example.com');
    });

    it('должен обрабатывать null', () => {
      expect(maskEmail(null)).toBe('***');
    });

    it('должен обрабатывать email без @', () => {
      expect(maskEmail('invalid-email')).toBe('***');
    });
  });

  describe('maskSensitiveData', () => {
    it('должен маскировать все sensitive поля в объекте', () => {
      const data = {
        phoneNumber: '+79377281319',
        phone: '+79991234567',
        sessionId: '1234567890abcdef',
        password: 'secret123',
        email: 'user@example.com',
        otherField: 'should not be masked',
      };

      const masked = maskSensitiveData(data);

      expect(masked.phoneNumber).toBe('+79*****319');
      expect(masked.phone).toBe('+79*****567');
      expect(masked.sessionId).toBe('12345678...');
      expect(masked.password).toBe('***');
      expect(masked.email).toBe('***@example.com');
      expect(masked.otherField).toBe('should not be masked');
    });

    it('должен обрабатывать объект без sensitive полей', () => {
      const data = {
        name: 'John',
        age: 30,
      };

      const masked = maskSensitiveData(data);

      expect(masked.name).toBe('John');
      expect(masked.age).toBe(30);
    });

    it('должен обрабатывать пустой объект', () => {
      const masked = maskSensitiveData({});
      expect(masked).toEqual({});
    });
  });
});

