/**
 * Типизация ErrorCode → HTTP status
 * 
 * Убирает магию из фильтров и обеспечивает единообразный маппинг
 * всех ErrorCode в соответствующие HTTP статус коды
 */

import { ErrorCode } from '../interfaces/error-response.interface';

/**
 * Маппинг ErrorCode → HTTP status code
 */
export const ERROR_HTTP_MAP: Record<ErrorCode, number> = {
  // Validation errors (400)
  VALIDATION_ERROR: 400,

  // Authentication errors (401)
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_2FA_PASSWORD: 401,
  SESSION_INVALID: 403, // КРИТИЧНО: Изменено на 403, так как используется в ForbiddenException
  SESSION_NOT_FOUND: 401,
  PASSWORD_HASH_INVALID: 401,
  
  // Telegram session status (403)
  TELEGRAM_SESSION_NOT_READY: 403, // Сессия существует, но еще не активна

  // Not found errors (404)
  NOT_FOUND: 404,

  // Rate limiting (429)
  FLOOD_WAIT: 429,
  TOO_MANY_REQUESTS: 429,

  // Server errors (500)
  INTERNAL_SERVER_ERROR: 500,

  // Telegram-specific errors
  PHONE_CODE_EXPIRED: 400,
  PHONE_CODE_INVALID: 400,
  PHONE_NUMBER_INVALID: 400,
  PHONE_NUMBER_BANNED: 403,
  AUTH_KEY_UNREGISTERED: 401,

  // Telegram migration errors
  DC_MIGRATE: 409,

  // Timeout errors
  TIMEOUT: 504,

  // Retry errors
  RETRY: 409,
};

/**
 * Получает HTTP статус код для ErrorCode
 * 
 * @param errorCode - Код ошибки
 * @returns HTTP статус код
 */
export function getHttpStatusForErrorCode(errorCode: ErrorCode | string): number {
  if (errorCode in ERROR_HTTP_MAP) {
    return ERROR_HTTP_MAP[errorCode as ErrorCode];
  }
  // Fallback для неизвестных кодов
  return 500;
}

