/**
 * Contract test для ErrorResponse
 * Проверяет, что все ошибки соответствуют ErrorResponse контракту
 * Это защищает от регрессий и гарантирует, что UI всегда получает правильный формат
 */

import { ErrorResponse } from './error-response.interface';

/**
 * Валидирует, что объект соответствует ErrorResponse контракту
 * Используется в тестах для проверки всех ответов API
 */
export function validateErrorResponse(response: any): response is ErrorResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  // Проверяем обязательные поля
  if (response.success !== false) {
    return false;
  }

  if (typeof response.statusCode !== 'number') {
    return false;
  }

  if (typeof response.errorCode !== 'string' || response.errorCode.length === 0) {
    return false;
  }

  // КРИТИЧНО: message должен быть строкой, а не объектом или массивом
  if (typeof response.message !== 'string') {
    return false;
  }

  // Проверяем опциональные поля
  if (response.details !== undefined) {
    if (!Array.isArray(response.details)) {
      return false;
    }
    
    // Каждый detail должен иметь field и message (строки)
    for (const detail of response.details) {
      if (typeof detail !== 'object' || detail === null) {
        return false;
      }
      if (typeof detail.field !== 'string' || typeof detail.message !== 'string') {
        return false;
      }
    }
  }

  if (response.retryAfter !== undefined) {
    if (typeof response.retryAfter !== 'number' || response.retryAfter < 0) {
      return false;
    }
  }

  return true;
}

/**
 * Проверяет, что message не является объектом или массивом
 * Это критично для предотвращения React error #31
 */
export function isMessageSafe(message: any): message is string {
  return typeof message === 'string' && message.length > 0;
}

/**
 * Извлекает безопасное сообщение об ошибке из ответа
 * Гарантирует, что возвращается строка, а не объект
 */
export function extractSafeMessage(response: any): string {
  if (!response) {
    return 'Неизвестная ошибка';
  }

  // Если это ErrorResponse контракт
  if (validateErrorResponse(response)) {
    return response.message;
  }

  // Fallback для старых форматов
  if (typeof response.message === 'string') {
    return response.message;
  }

  if (typeof response.error === 'string') {
    return response.error;
  }

  return 'Неизвестная ошибка';
}

