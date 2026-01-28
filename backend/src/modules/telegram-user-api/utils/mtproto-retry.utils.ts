/**
 * Retry-логика для MTProto client.invoke (модуль telegram-user-api)
 */

import { handleMtprotoError, MtprotoErrorAction } from './mtproto-error.handler';

export type InvokeClient = { invoke: (r: object, p?: unknown) => Promise<unknown> };

export interface InvokeWithRetryOptions {
  maxRetries?: number;
  onRetry?: (retryAfterSeconds: number, attempt: number) => void;
}

const DEFAULT_MAX_RETRIES = 2;

export async function invokeWithRetry<T = unknown>(
  client: InvokeClient,
  request: object,
  options?: InvokeWithRetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const onRetry = options?.onRetry;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return (await client.invoke(request)) as T;
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
