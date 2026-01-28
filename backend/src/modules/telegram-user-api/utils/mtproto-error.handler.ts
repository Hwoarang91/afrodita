/**
 * Централизованная обработка MTProto ошибок (модуль telegram-user-api)
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
  errorResponse?: ErrorResponse;
}

export function handleMtprotoError(e: unknown): MtprotoErrorResult {
  const message = getErrorMessage(e);
  const errorResponse = mapTelegramErrorToResponse(e);

  if (isFatalTelegramError(e)) {
    return {
      action: MtprotoErrorAction.INVALIDATE_SESSION,
      reason: message,
      errorResponse,
    };
  }

  if (isRequire2faActionError(e)) {
    return {
      action: MtprotoErrorAction.REQUIRE_2FA,
      reason: errorResponse?.message || message,
      errorResponse,
    };
  }

  if (isRetryableTelegramError(e)) {
    return {
      action: MtprotoErrorAction.RETRY,
      reason: message,
      errorResponse,
      retryAfter: errorResponse.retryAfter,
    };
  }

  return {
    action: MtprotoErrorAction.SAFE_ERROR,
    reason: message,
    errorResponse,
  };
}
