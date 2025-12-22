/**
 * Константы для Telegram авторизации
 * Зафиксированы в одном месте для предотвращения регрессий
 */

/**
 * Разрешенные ключи для payload /auth/telegram/2fa/verify
 * Любые другие поля будут отклонены ValidationPipe с forbidNonWhitelisted: true
 */
export const TELEGRAM_2FA_VERIFY_ALLOWED_KEYS = [
  'phoneNumber',
  'password',
  'phoneCodeHash',
] as const;

/**
 * Запрещенные поля, которые НИКОГДА не должны попадать в 2FA verify запрос
 * Используется в interceptor для агрессивной очистки
 */
export const TELEGRAM_2FA_VERIFY_FORBIDDEN_KEYS = [
  'userId',
  'sessionId',
  'client',
  'user',
] as const;

/**
 * Тип для проверки allowed keys
 */
export type Telegram2FAVerifyAllowedKey = typeof TELEGRAM_2FA_VERIFY_ALLOWED_KEYS[number];

/**
 * Проверяет, является ли ключ разрешенным для 2FA verify
 */
export function isAllowedKey(key: string): key is Telegram2FAVerifyAllowedKey {
  return (TELEGRAM_2FA_VERIFY_ALLOWED_KEYS as readonly string[]).includes(key);
}

