/**
 * Централизованная обработка MTProto ошибок
 * Определяет тип ошибки и возвращает действие для обработки
 */

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
}

/**
 * Обрабатывает MTProto ошибку и возвращает действие для обработки
 */
export function handleMtprotoError(e: any): MtprotoErrorResult {
  const message = e?.errorMessage || e?.message || String(e || '');

  // 🔴 FATAL - инвалидировать сессию немедленно
  if (
    message.includes('AUTH_KEY_UNREGISTERED') ||
    message.includes('SESSION_REVOKED') ||
    message.includes('SESSION_EXPIRED') ||
    message.includes('AUTH_KEY_DUPLICATED') ||
    message.includes('USER_DEACTIVATED') ||
    message.includes('PHONE_NUMBER_BANNED') ||
    message.includes('USER_DEACTIVATED_BAN') ||
    message.includes('ACCOUNT_DISABLED') ||
    message.includes('CONNECTION_LAYER_INVALID')
  ) {
    return {
      action: MtprotoErrorAction.INVALIDATE_SESSION,
      reason: message,
    };
  }

  // 🟠 AUTH FLOW - требуется действие пользователя
  if (message.includes('SESSION_PASSWORD_NEEDED')) {
    return {
      action: MtprotoErrorAction.REQUIRE_2FA,
      reason: '2FA password required',
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
    };
  }

  // 🟡 FLOOD WAIT - повторить после задержки
  const floodMatch = message.match(/FLOOD_WAIT_(\d+)/);
  if (floodMatch) {
    return {
      action: MtprotoErrorAction.RETRY,
      reason: message,
      retryAfter: parseInt(floodMatch[1], 10),
    };
  }

  // 🟡 RETRYABLE - временные ошибки
  if (
    message.includes('INTERNAL_SERVER_ERROR') ||
    message.includes('RPC_CALL_FAIL') ||
    message.includes('NETWORK_MIGRATE') ||
    message.includes('PHONE_MIGRATE')
  ) {
    return {
      action: MtprotoErrorAction.RETRY,
      reason: message,
    };
  }

  // 🟢 SAFE - бизнес-ошибки, не требующие инвалидации сессии
  return {
    action: MtprotoErrorAction.SAFE_ERROR,
    reason: message,
  };
}

