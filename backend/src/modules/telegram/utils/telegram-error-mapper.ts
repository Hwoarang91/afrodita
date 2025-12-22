/**
 * Маппинг Telegram MTProto ошибок → ErrorCode
 * Преобразует Telegram ошибки в стандартизированный ErrorResponse
 * Это позволяет UI работать с типизированными кодами ошибок, а не парсить строки
 */

import { ErrorCode } from '../../../common/interfaces/error-response.interface';
import { buildErrorResponse } from '../../../common/utils/error-response.builder';

/**
 * Результат маппинга Telegram ошибки
 */
export interface TelegramErrorMapping {
  statusCode: number;
  errorCode: ErrorCode | string;
  message: string;
  retryAfter?: number;
}

/**
 * Маппит Telegram MTProto ошибку в стандартизированный ErrorResponse
 * 
 * @param error - Telegram ошибка (может быть Error, string, или объект с message)
 * @returns ErrorResponse с правильным errorCode и message
 */
export function mapTelegramError(error: any): TelegramErrorMapping {
  const message = error?.errorMessage || error?.message || String(error || '').trim();
  
  // 🔴 FLOOD_WAIT - Rate limiting (429)
  const floodWaitMatch = message.match(/FLOOD_WAIT_(\d+)/i);
  if (floodWaitMatch) {
    const seconds = parseInt(floodWaitMatch[1], 10);
    return {
      statusCode: 429,
      errorCode: ErrorCode.FLOOD_WAIT,
      message: `Слишком много запросов. Повторите через ${seconds} секунд.`,
      retryAfter: seconds,
    };
  }

  const floodPremiumMatch = message.match(/FLOOD_PREMIUM_WAIT_(\d+)/i);
  if (floodPremiumMatch) {
    const seconds = parseInt(floodPremiumMatch[1], 10);
    return {
      statusCode: 429,
      errorCode: ErrorCode.FLOOD_WAIT,
      message: `Превышен лимит Telegram. Повторите через ${seconds} секунд.`,
      retryAfter: seconds,
    };
  }

  // 🔴 PHONE CODE ошибки (400)
  if (message.includes('PHONE_CODE_INVALID') || message.match(/PHONE_CODE_INVALID/i)) {
    return {
      statusCode: 400,
      errorCode: ErrorCode.PHONE_CODE_INVALID,
      message: 'Неверный код подтверждения. Проверьте и введите код заново.',
    };
  }

  if (message.includes('PHONE_CODE_EXPIRED') || message.match(/PHONE_CODE_EXPIRED/i)) {
    return {
      statusCode: 400,
      errorCode: ErrorCode.PHONE_CODE_EXPIRED,
      message: 'Код подтверждения истёк. Запросите новый код.',
    };
  }

  if (message.includes('PHONE_NUMBER_INVALID') || message.match(/PHONE_NUMBER_INVALID/i)) {
    return {
      statusCode: 400,
      errorCode: ErrorCode.PHONE_NUMBER_INVALID,
      message: 'Некорректный номер телефона. Проверьте формат номера.',
    };
  }

  if (message.includes('PHONE_NUMBER_FLOOD') || message.match(/PHONE_NUMBER_FLOOD/i)) {
    return {
      statusCode: 429,
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
      message: 'Слишком много попыток отправки кода. Подождите перед следующей попыткой.',
    };
  }

  // 🔴 2FA ошибки (401)
  if (
    message.includes('PASSWORD_HASH_INVALID') ||
    message.includes('SESSION_PASSWORD_NEEDED') ||
    message.match(/PASSWORD_HASH_INVALID|SESSION_PASSWORD_NEEDED/i)
  ) {
    return {
      statusCode: 401,
      errorCode: ErrorCode.INVALID_2FA_PASSWORD,
      message: 'Неверный пароль двухфакторной аутентификации.',
    };
  }

  // 🔴 СЕССИЯ НЕДЕЙСТВИТЕЛЬНА (401) - фатальные ошибки, требующие инвалидации
  if (
    message.includes('AUTH_KEY_UNREGISTERED') ||
    message.includes('SESSION_REVOKED') ||
    message.includes('AUTH_KEY_DUPLICATED') ||
    message.includes('USER_DEACTIVATED') ||
    message.match(/AUTH_KEY_UNREGISTERED|SESSION_REVOKED|AUTH_KEY_DUPLICATED|USER_DEACTIVATED/i)
  ) {
    return {
      statusCode: 401,
      errorCode: ErrorCode.SESSION_INVALID,
      message: 'Telegram сессия недействительна. Требуется повторная авторизация.',
    };
  }

  // 🔴 ЗАБЛОКИРОВАННЫЙ НОМЕР (403)
  if (message.includes('PHONE_NUMBER_BANNED') || message.match(/PHONE_NUMBER_BANNED/i)) {
    return {
      statusCode: 403,
      errorCode: ErrorCode.PHONE_NUMBER_BANNED,
      message: 'Номер телефона заблокирован Telegram.',
    };
  }

  // 🟡 MIGRATE ошибки (307) - требуют retry на backend
  const dcMigrateMatch = message.match(/DC_MIGRATE_(\d+)/i);
  if (dcMigrateMatch) {
    return {
      statusCode: 500, // Внутренняя ошибка, backend должен обработать retry
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Перенаправление на другой дата-центр. Повторите запрос.',
    };
  }

  const networkMigrateMatch = message.match(/NETWORK_MIGRATE_(\d+)/i);
  if (networkMigrateMatch) {
    return {
      statusCode: 500,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Перенаправление сети. Повторите запрос.',
    };
  }

  const userMigrateMatch = message.match(/USER_MIGRATE_(\d+)/i);
  if (userMigrateMatch) {
    return {
      statusCode: 500,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Перенаправление пользователя. Повторите запрос.',
    };
  }

  // 🟡 RETRYABLE ошибки (500) - временные проблемы
  if (
    message.includes('RPC_CALL_FAIL') ||
    message.includes('TIMEOUT') ||
    message.includes('INTERNAL') ||
    message.match(/RPC_CALL_FAIL|TIMEOUT|INTERNAL/i)
  ) {
    return {
      statusCode: 500,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Временная ошибка Telegram. Повторите запрос позже.',
    };
  }

  // 🟢 FALLBACK - неизвестная ошибка
  return {
    statusCode: 500,
    errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
    message: `Неизвестная ошибка Telegram: ${message}`,
  };
}

/**
 * Преобразует Telegram ошибку в стандартизированный ErrorResponse
 * Используется в контроллерах и сервисах для единообразной обработки ошибок
 */
export function mapTelegramErrorToResponse(error: any) {
  const mapping = mapTelegramError(error);
  return buildErrorResponse(
    mapping.statusCode,
    mapping.errorCode,
    mapping.message,
    undefined,
    mapping.retryAfter,
  );
}

