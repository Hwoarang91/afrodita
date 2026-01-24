/**
 * Централизованная обработка MTProto ошибок
 * Определяет тип ошибки и возвращает действие для обработки
 * Интегрирован с ErrorResponse contract для единообразной обработки ошибок
 */

import { ErrorResponse } from '../../../common/interfaces/error-response.interface';
import { getErrorMessage } from '../../../common/utils/error-message';
import {
  mapTelegramErrorToResponse,
  isFatalTelegramError,
  isRetryableTelegramError,
  isRequire2faActionError,
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
export function handleMtprotoError(e: unknown): MtprotoErrorResult {
  const message = getErrorMessage(e);
  const errorResponse = mapTelegramErrorToResponse(e);

  // 🔴 FATAL - инвалидировать сессию немедленно
  if (isFatalTelegramError(e)) {
    return {
      action: MtprotoErrorAction.INVALIDATE_SESSION,
      reason: message,
      errorResponse,
    };
  }

  // 🟠 AUTH FLOW - требуется действие пользователя (проверки только в mapper)
  if (isRequire2faActionError(e)) {
    return {
      action: MtprotoErrorAction.REQUIRE_2FA,
      reason: errorResponse?.message || message,
      errorResponse,
    };
  }

  // 🟡 RETRYABLE - FLOOD_WAIT, DC_MIGRATE и др. (retryAfter из mapper)
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

