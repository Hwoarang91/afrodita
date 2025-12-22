/**
 * Единый контракт для всех ошибок API
 * Гарантирует, что UI всегда получает строку в message, а не объект или массив
 * Это предотвращает React error #31 и подобные баги
 */

/**
 * Детальная информация об ошибке валидации для конкретного поля
 */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Базовый интерфейс для всех ошибок API
 */
export interface ErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string; // MACHINE-READABLE код ошибки для программной обработки
  message: string; // HUMAN-READABLE сообщение (ВСЕГДА строка!)
  details?: ErrorDetail[]; // Опциональные детали (для валидации)
  retryAfter?: number; // Для rate limiting (секунды)
}

/**
 * Коды ошибок (machine-readable)
 * Используются для программной обработки на клиенте
 */
export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_2FA_PASSWORD = 'INVALID_2FA_PASSWORD',
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  PASSWORD_HASH_INVALID = 'PASSWORD_HASH_INVALID',
  
  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  
  // Rate limiting (429)
  FLOOD_WAIT = 'FLOOD_WAIT',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Server errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  
  // Telegram-specific errors
  PHONE_CODE_EXPIRED = 'PHONE_CODE_EXPIRED',
  PHONE_CODE_INVALID = 'PHONE_CODE_INVALID',
  PHONE_NUMBER_INVALID = 'PHONE_NUMBER_INVALID',
  PHONE_NUMBER_BANNED = 'PHONE_NUMBER_BANNED',
  
  // Telegram migration errors
  DC_MIGRATE = 'DC_MIGRATE',
  
  // Timeout errors
  TIMEOUT = 'TIMEOUT',
  
  // Retry errors
  RETRY = 'RETRY',
}

