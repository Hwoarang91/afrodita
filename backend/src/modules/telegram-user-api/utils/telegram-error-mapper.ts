/**
 * Эталонный маппинг Telegram MTProto ошибок → ErrorCode
 * (Модуль telegram-user-api — «От своего лица»)
 *
 * Гарантирует:
 * - 100% покрытие реально встречающихся MTProto ошибок
 * - Нет string.includes() в бизнес-коде
 * - Предсказуемое поведение UI
 * - Канонический слой нормализации
 */

import { ErrorCode } from '../../../common/interfaces/error-response.interface';
import { buildErrorResponse } from '../../../common/utils/error-response.builder';
import { getHttpStatusForErrorCode } from '../../../common/utils/error-code-http-map';

export interface TelegramErrorMapping {
  statusCode: number;
  errorCode: ErrorCode | string;
  message: string;
  retryAfter?: number;
}

export function mapTelegramError(error: unknown): TelegramErrorMapping {
  const e = error as { errorMessage?: string; message?: string } | null | undefined;
  const message = e?.errorMessage || e?.message || String(error ?? '').trim();
  const upperMessage = message.toUpperCase();

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
      statusCode: getHttpStatusForErrorCode(ErrorCode.FLOOD_WAIT),
      errorCode: ErrorCode.FLOOD_WAIT,
      message: `Превышен лимит Telegram. Повторите через ${seconds} секунд.`,
      retryAfter: seconds,
    };
  }

  if (upperMessage.includes('PHONE_NUMBER_FLOOD')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.TOO_MANY_REQUESTS),
      errorCode: ErrorCode.TOO_MANY_REQUESTS,
      message: 'Слишком много попыток отправки кода. Подождите перед следующей попыткой.',
    };
  }

  if (upperMessage.includes('PHONE_CODE_INVALID')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.PHONE_CODE_INVALID),
      errorCode: ErrorCode.PHONE_CODE_INVALID,
      message: 'Неверный код подтверждения. Проверьте и введите код заново.',
    };
  }

  if (upperMessage.includes('PHONE_CODE_EXPIRED')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.PHONE_CODE_EXPIRED),
      errorCode: ErrorCode.PHONE_CODE_EXPIRED,
      message: 'Код подтверждения истёк. Запросите новый код.',
    };
  }

  if (upperMessage.includes('PHONE_NUMBER_INVALID')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.PHONE_NUMBER_INVALID),
      errorCode: ErrorCode.PHONE_NUMBER_INVALID,
      message: 'Некорректный номер телефона. Проверьте формат номера.',
    };
  }

  if (
    upperMessage.includes('PASSWORD_HASH_INVALID') ||
    upperMessage.includes('SESSION_PASSWORD_NEEDED')
  ) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.INVALID_2FA_PASSWORD),
      errorCode: ErrorCode.INVALID_2FA_PASSWORD,
      message: 'Неверный пароль двухфакторной аутентификации.',
    };
  }

  if (upperMessage.includes('SRP_PASSWORD_CHANGED')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.INVALID_2FA_PASSWORD),
      errorCode: ErrorCode.INVALID_2FA_PASSWORD,
      message: 'Пароль двухфакторной аутентификации был изменён. Введите новый пароль.',
    };
  }

  if (upperMessage.includes('AUTH_KEY_UNREGISTERED')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.SESSION_INVALID),
      errorCode: ErrorCode.SESSION_INVALID,
      message: 'Telegram сессия недействительна. Требуется повторная авторизация.',
    };
  }

  if (upperMessage.includes('SESSION_REVOKED')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.SESSION_INVALID),
      errorCode: ErrorCode.SESSION_INVALID,
      message: 'Telegram сессия отозвана. Требуется повторная авторизация.',
    };
  }

  if (upperMessage.includes('AUTH_KEY_DUPLICATED')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.SESSION_INVALID),
      errorCode: ErrorCode.SESSION_INVALID,
      message: 'Telegram сессия вытеснена. Требуется повторная авторизация.',
    };
  }

  if (upperMessage.includes('AUTH_RESTART')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.SESSION_INVALID),
      errorCode: ErrorCode.SESSION_INVALID,
      message: 'Требуется перезапуск авторизации Telegram.',
    };
  }

  if (upperMessage.includes('USER_DEACTIVATED') && !upperMessage.includes('BAN')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.SESSION_INVALID),
      errorCode: ErrorCode.SESSION_INVALID,
      message: 'Telegram аккаунт деактивирован.',
    };
  }

  if (upperMessage.includes('USER_DEACTIVATED_BAN')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.SESSION_INVALID),
      errorCode: ErrorCode.SESSION_INVALID,
      message: 'Telegram аккаунт заблокирован.',
    };
  }

  if (upperMessage.includes('PHONE_NUMBER_BANNED')) {
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.PHONE_NUMBER_BANNED),
      errorCode: ErrorCode.PHONE_NUMBER_BANNED,
      message: 'Номер телефона заблокирован Telegram.',
    };
  }

  const dcMigrateMatch = message.match(/DC_MIGRATE_(\d+)/i);
  if (dcMigrateMatch) {
    const dcId = dcMigrateMatch[1];
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.DC_MIGRATE),
      errorCode: ErrorCode.DC_MIGRATE,
      message: `Перенаправление на дата-центр ${dcId}. Повторите запрос.`,
    };
  }

  const networkMigrateMatch = message.match(/NETWORK_MIGRATE_(\d+)/i);
  if (networkMigrateMatch) {
    const dcId = networkMigrateMatch[1];
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.DC_MIGRATE),
      errorCode: ErrorCode.DC_MIGRATE,
      message: `Перенаправление сети на дата-центр ${dcId}. Повторите запрос.`,
    };
  }

  const fileMigrateMatch = message.match(/FILE_MIGRATE_(\d+)/i);
  if (fileMigrateMatch) {
    const dcId = fileMigrateMatch[1];
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.DC_MIGRATE),
      errorCode: ErrorCode.DC_MIGRATE,
      message: `Перенаправление файлов на дата-центр ${dcId}. Повторите запрос.`,
    };
  }

  const phoneMigrateMatch = message.match(/PHONE_MIGRATE_(\d+)/i);
  if (phoneMigrateMatch) {
    const dcId = phoneMigrateMatch[1];
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.DC_MIGRATE),
      errorCode: ErrorCode.DC_MIGRATE,
      message: `Перенаправление пользователя на дата-центр ${dcId}. Повторите запрос.`,
    };
  }

  const userMigrateMatch = message.match(/USER_MIGRATE_(\d+)/i);
  if (userMigrateMatch) {
    const dcId = userMigrateMatch[1];
    return {
      statusCode: getHttpStatusForErrorCode(ErrorCode.DC_MIGRATE),
      errorCode: ErrorCode.DC_MIGRATE,
      message: `Перенаправление пользователя на дата-центр ${dcId}. Повторите запрос.`,
    };
  }

  if (upperMessage.includes('MSG_WAIT_FAILED')) {
    return {
      statusCode: 409,
      errorCode: ErrorCode.RETRY,
      message: 'Запрос не завершён. Повторите попытку.',
    };
  }

  if (upperMessage.includes('RPC_CALL_FAIL')) {
    return {
      statusCode: 500,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Временная ошибка Telegram RPC. Повторите запрос позже.',
    };
  }

  if (upperMessage.includes('TIMEOUT')) {
    return {
      statusCode: 504,
      errorCode: ErrorCode.TIMEOUT,
      message: 'Превышено время ожидания ответа от Telegram. Повторите запрос.',
    };
  }

  if (upperMessage.includes('CONNECTION_NOT_INITED')) {
    return {
      statusCode: 500,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Ошибка соединения с Telegram. Требуется пересоздание клиента.',
    };
  }

  if (upperMessage.includes('INTERNAL_SERVER_ERROR') || upperMessage.includes('INTERNAL')) {
    return {
      statusCode: 500,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Временная ошибка Telegram. Повторите запрос позже.',
    };
  }

  return {
    statusCode: 500,
    errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
    message: 'Произошла ошибка при обращении к Telegram. Повторите попытку позже.',
  };
}

export function mapTelegramErrorToResponse(error: unknown) {
  const mapping = mapTelegramError(error);
  return buildErrorResponse(
    mapping.statusCode,
    mapping.errorCode,
    mapping.message,
    undefined,
    mapping.retryAfter,
  );
}

export function isFatalTelegramError(error: unknown): boolean {
  const mapping = mapTelegramError(error);
  return mapping.errorCode === ErrorCode.SESSION_INVALID;
}

export function isRetryableTelegramError(error: unknown): boolean {
  const mapping = mapTelegramError(error);
  return [
    ErrorCode.FLOOD_WAIT,
    ErrorCode.DC_MIGRATE,
    ErrorCode.RETRY,
    ErrorCode.TIMEOUT,
    ErrorCode.INTERNAL_SERVER_ERROR,
  ].includes(mapping.errorCode as ErrorCode);
}

export function isRequire2faActionError(error: unknown): boolean {
  const mapping = mapTelegramError(error);
  return [
    ErrorCode.INVALID_2FA_PASSWORD,
    ErrorCode.PHONE_CODE_INVALID,
    ErrorCode.PHONE_CODE_EXPIRED,
    ErrorCode.PHONE_NUMBER_INVALID,
  ].includes(mapping.errorCode as ErrorCode);
}
