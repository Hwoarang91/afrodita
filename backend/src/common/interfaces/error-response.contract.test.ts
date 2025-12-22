/**
 * Contract test для ErrorResponse
 * Проверяет, что все ошибки соответствуют контракту
 * 
 * Запуск: npm test -- error-response.contract.test
 */

import { validateErrorResponse, isMessageSafe, extractSafeMessage } from './error-response.contract.spec';
import { ErrorResponse, ErrorCode } from './error-response.interface';
import { buildErrorResponse, buildValidationErrorResponse } from '../utils/error-response.builder';

describe('ErrorResponse Contract', () => {
  describe('validateErrorResponse', () => {
    it('должен валидировать корректный ErrorResponse', () => {
      const response: ErrorResponse = {
        success: false,
        statusCode: 400,
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'Некорректные данные',
      };

      expect(validateErrorResponse(response)).toBe(true);
    });

    it('должен валидировать ErrorResponse с details', () => {
      const response: ErrorResponse = {
        success: false,
        statusCode: 400,
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'Некорректные данные',
        details: [
          { field: 'phoneNumber', message: 'Некорректный номер телефона' },
        ],
      };

      expect(validateErrorResponse(response)).toBe(true);
    });

    it('должен валидировать ErrorResponse с retryAfter', () => {
      const response: ErrorResponse = {
        success: false,
        statusCode: 429,
        errorCode: ErrorCode.FLOOD_WAIT,
        message: 'Слишком много запросов',
        retryAfter: 42,
      };

      expect(validateErrorResponse(response)).toBe(true);
    });

    it('должен отклонять объект с message как массив', () => {
      const response = {
        success: false,
        statusCode: 400,
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: [{ property: 'userId', constraints: {} }], // ❌ массив вместо строки
      };

      expect(validateErrorResponse(response)).toBe(false);
    });

    it('должен отклонять объект с message как объект', () => {
      const response = {
        success: false,
        statusCode: 400,
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: { property: 'userId', constraints: {} }, // ❌ объект вместо строки
      };

      expect(validateErrorResponse(response)).toBe(false);
    });

    it('должен отклонять объект без обязательных полей', () => {
      const response = {
        statusCode: 400,
        message: 'Ошибка',
        // ❌ отсутствует success и errorCode
      };

      expect(validateErrorResponse(response)).toBe(false);
    });
  });

  describe('buildErrorResponse', () => {
    it('должен создавать валидный ErrorResponse', () => {
      const response = buildErrorResponse(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Некорректные данные',
      );

      expect(validateErrorResponse(response)).toBe(true);
      expect(response.message).toBe('Некорректные данные');
      expect(typeof response.message).toBe('string');
    });

    it('должен создавать ErrorResponse с details', () => {
      const response = buildValidationErrorResponse([
        {
          property: 'phoneNumber',
          constraints: { isString: 'phoneNumber must be a string' },
        },
      ]);

      expect(validateErrorResponse(response)).toBe(true);
      expect(response.details).toBeDefined();
      expect(Array.isArray(response.details)).toBe(true);
      expect(response.details?.length).toBe(1);
    });
  });

  describe('isMessageSafe', () => {
    it('должен возвращать true для строки', () => {
      expect(isMessageSafe('Ошибка')).toBe(true);
    });

    it('должен возвращать false для массива', () => {
      expect(isMessageSafe([{ property: 'userId' }])).toBe(false);
    });

    it('должен возвращать false для объекта', () => {
      expect(isMessageSafe({ property: 'userId' })).toBe(false);
    });
  });

  describe('extractSafeMessage', () => {
    it('должен извлекать message из ErrorResponse', () => {
      const response: ErrorResponse = {
        success: false,
        statusCode: 400,
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'Некорректные данные',
      };

      expect(extractSafeMessage(response)).toBe('Некорректные данные');
    });

    it('должен возвращать fallback для невалидного ответа', () => {
      const response = { invalid: 'data' };
      expect(extractSafeMessage(response)).toBe('Неизвестная ошибка');
    });
  });
});

