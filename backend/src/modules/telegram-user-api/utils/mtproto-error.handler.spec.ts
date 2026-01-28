import {
  handleMtprotoError,
  MtprotoErrorAction,
} from './mtproto-error.handler';

describe('mtproto-error.handler', () => {
  it('INVALIDATE_SESSION для SESSION_REVOKED', () => {
    const r = handleMtprotoError(new Error('SESSION_REVOKED'));
    expect(r.action).toBe(MtprotoErrorAction.INVALIDATE_SESSION);
    expect(r.errorResponse).toBeDefined();
  });

  it('REQUIRE_2FA для PASSWORD_HASH_INVALID', () => {
    const r = handleMtprotoError(new Error('PASSWORD_HASH_INVALID'));
    expect(r.action).toBe(MtprotoErrorAction.REQUIRE_2FA);
  });

  it('RETRY для FLOOD_WAIT с retryAfter', () => {
    const r = handleMtprotoError(new Error('FLOOD_WAIT_5'));
    expect(r.action).toBe(MtprotoErrorAction.RETRY);
    expect(r.retryAfter).toBe(5);
  });

  it('RETRY для DC_MIGRATE', () => {
    const r = handleMtprotoError(new Error('DC_MIGRATE_2'));
    expect(r.action).toBe(MtprotoErrorAction.RETRY);
  });

  it('SAFE_ERROR для неизвестной ошибки', () => {
    const r = handleMtprotoError(new Error('UNKNOWN_ERROR'));
    expect(r.action).toBe(MtprotoErrorAction.SAFE_ERROR);
  });
});
