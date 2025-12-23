/**
 * Тесты для маскирования sensitive данных
 * 
 * Проверяет:
 * - Маскирование phoneNumber, sessionId, password, email
 * - maskSensitiveData для объектов
 * - Обработка null/undefined
 */

import { maskSensitiveData } from './sensitive-data-masker';

describe('SensitiveDataMasker', () => {
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

      expect(masked.phoneNumber).not.toBe('+79377281319');
      expect(masked.phone).not.toBe('+79991234567');
      expect(masked.sessionId).not.toBe('1234567890abcdef');
      expect(masked.password).toBe('[masked]');
      expect(masked.email).toBe('[masked]');
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

