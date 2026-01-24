/**
 * Retry-логика для MTProto client.invoke (§17).
 * При RETRY (FLOOD_WAIT, DC_MIGRATE и т.п.) ждёт retryAfter и повторяет вызов.
 */

import { handleMtprotoError, MtprotoErrorAction } from './mtproto-error.handler';

export interface InvokeWithRetryOptions {
  /** Макс. повторов при RETRY (по умолчанию 2 → до 3 попыток) */
  maxRetries?: number;
  /** Вызов перед ожиданием (для emitFloodWait, логирования) */
  onRetry?: (retryAfterSeconds: number, attempt: number) => void;
}

const DEFAULT_MAX_RETRIES = 2;

/**
 * Выполняет client.invoke с retry при RETRY-ошибках (FLOOD_WAIT и др.).
 * При MtprotoErrorAction.RETRY и retryAfter ждёт и повторяет до maxRetries раз.
 * Остальные действия (INVALIDATE_SESSION, REQUIRE_2FA, SAFE_ERROR) — пробрасывает.
 */
export async function invokeWithRetry<T = unknown>(
  client: { invoke: (r: object) => Promise<T> },
  request: object,
  options?: InvokeWithRetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const onRetry = options?.onRetry;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.invoke(request);
    } catch (e: unknown) {
      lastError = e;
      const result = handleMtprotoError(e);

      const canRetry =
        result.action === MtprotoErrorAction.RETRY &&
        typeof result.retryAfter === 'number' &&
        result.retryAfter > 0 &&
        attempt < maxRetries;

      if (canRetry && typeof result.retryAfter === 'number') {
        const sec = result.retryAfter;
        const waitMs = sec * 1000;
        onRetry?.(sec, attempt + 1);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      throw e;
    }
  }

  throw lastError;
}
