import { invokeWithRetry, type InvokeClient } from './mtproto-retry.utils';

describe('mtproto-retry.utils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('возвращает результат при успешном invoke', async () => {
    const client: InvokeClient = {
      invoke: jest.fn().mockResolvedValue({ ok: true }),
    };
    const p = invokeWithRetry(client, { _: 'test' });
    await expect(p).resolves.toEqual({ ok: true });
    expect(client.invoke).toHaveBeenCalledTimes(1);
  });

  it('пробрасывает ошибку при не-retryable (SESSION_REVOKED)', async () => {
    const client: InvokeClient = {
      invoke: jest.fn().mockRejectedValue(new Error('SESSION_REVOKED')),
    };
    const p = invokeWithRetry(client, { _: 'test' });
    await expect(p).rejects.toThrow(/SESSION_REVOKED/);
    expect(client.invoke).toHaveBeenCalledTimes(1);
  });

  it('делает retry при FLOOD_WAIT и затем успех', async () => {
    const client: InvokeClient = {
      invoke: jest
        .fn()
        .mockRejectedValueOnce(new Error('FLOOD_WAIT_1'))
        .mockResolvedValueOnce({ ok: true }),
    };
    const onRetry = jest.fn();
    const p = invokeWithRetry(client, { _: 'test' }, { maxRetries: 2, onRetry });

    await jest.advanceTimersByTimeAsync(1100);
    const result = await p;

    expect(result).toEqual({ ok: true });
    expect(client.invoke).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, 1);
  });
});
