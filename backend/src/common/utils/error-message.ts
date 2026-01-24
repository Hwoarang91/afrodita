/**
 * Безопасное извлечение message и stack из unknown (catch).
 * Используется в контроллерах и mtproto-error.handler вместо any.
 */
export function getErrorMessage(e: unknown): string {
  if (e == null) return '';
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && 'errorMessage' in e && typeof (e as { errorMessage: unknown }).errorMessage === 'string')
    return (e as { errorMessage: string }).errorMessage;
  if (typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string')
    return (e as { message: string }).message;
  return String(e);
}

export function getErrorStack(e: unknown): string | undefined {
  if (e instanceof Error) return e.stack;
  if (typeof e === 'object' && e != null && 'stack' in e && typeof (e as { stack: unknown }).stack === 'string')
    return (e as { stack: string }).stack;
  return undefined;
}

/** Код ошибки (напр. PG 23503). */
export function getErrorCode(e: unknown): string | undefined {
  if (e == null) return undefined;
  if (typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string')
    return (e as { code: string }).code;
  return undefined;
}
