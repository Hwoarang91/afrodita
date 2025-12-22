/**
 * Централизованная обработка MTProto ошибок
 * Определяет тип ошибки и возвращает действие для обработки
 * Интегрирован с ErrorResponse contract для единообразной обработки ошибок
 */

import { ErrorResponse } from '../../../common/interfaces/error-response.interface';
import { 
  mapTelegramError, 
  mapTelegramErrorToResponse,
  isFatalTelegramError,
  isRetryableTelegramError,
} from './telegram-error-mapper';

export enum MtprotoErrorAction {
  INVALIDATE_SESSION = 'invalidate_session',
  REQUIRE_2FA = 'require_2fa',
  RETRY = 'retry',
  SAFE_ERROR = 'safe_error',
}

export interface MtprotoErrorResult {
  action: MtprotoErrorAction;
  reason: string;
  retryAfter?: number;
  errorResponse?: ErrorResponse; // Стандартизированный ErrorResponse для возврата в контроллере
}

/**
 * Обрабатывает MTProto ошибку и возвращает действие для обработки
 * Теперь также возвращает стандартизированный ErrorResponse для использования в контроллерах
 */
export function handleMtprotoError(e: any): MtprotoErrorResult {
  const message = e?.errorMessage || e?.message || String(e || '');
  
  // Используем маппинг для получения стандартизированного ErrorResponse
  const errorMapping = mapTelegramError(e);
  const errorResponse = mapTelegramErrorToResponse(e);

  // 🔴 FATAL - инвалидировать сессию немедленно
  // Используем эталонный маппинг для определения фатальных ошибок
  if (isFatalTelegramError(e)) {
    return {
      action: MtprotoErrorAction.INVALIDATE_SESSION,
      reason: message,
      errorResponse,
    };
  }

  // 🟠 AUTH FLOW - требуется действие пользователя
  if (message.includes('SESSION_PASSWORD_NEEDED')) {
    return {
      action: MtprotoErrorAction.REQUIRE_2FA,
      reason: '2FA password required',
      errorResponse,
    };
  }

  if (
    message.includes('PHONE_CODE_INVALID') ||
    message.includes('PHONE_CODE_EXPIRED') ||
    message.includes('PASSWORD_HASH_INVALID') ||
    message.includes('PHONE_NUMBER_INVALID')
  ) {
    return {
      action: MtprotoErrorAction.REQUIRE_2FA,
      reason: message,
      errorResponse,
    };
  }

  // 🟡 FLOOD WAIT - повторить после задержки
  const floodMatch = message.match(/FLOOD_WAIT_(\d+)/);
  if (floodMatch) {
    return {
      action: MtprotoErrorAction.RETRY,
      reason: message,
      retryAfter: parseInt(floodMatch[1], 10),
      errorResponse,
    };
  }

  // 🟡 RETRYABLE - временные ошибки
  // Используем эталонный маппинг для определения retryable ошибок
  if (isRetryableTelegramError(e)) {
    return {
      action: MtprotoErrorAction.RETRY,
      reason: message,
      errorResponse,
      retryAfter: errorResponse.retryAfter,
    };
  }

  // 🟢 SAFE - бизнес-ошибки, не требующие инвалидации сессии
  return {
    action: MtprotoErrorAction.SAFE_ERROR,
    reason: message,
    errorResponse,
  };
}

