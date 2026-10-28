/**
 * Per-request auth checks now run as one Redis pipeline with throttled writes.
 * These tests pin the security contract: revoked tokens and locked accounts are
 * refused on every request, even right after a successful one.
 */
const store = new Map<string, string>();
const ttls = new Map<string, number>();
let callCount = 0;

function makePipeline() {
  const ops: Array<() => unknown> = [];
  const p = {
    exists: (k: string) => (ops.push(() => (store.has(k) ? 1 : 0)), p),
    get: (k: string) => (ops.push(() => store.get(k) ?? null), p),
    ttl: (k: string) => (ops.push(() => (store.has(k) ? ttls.get(k) ?? -1 : -2)), p),
    del: (k: string) => (ops.push(() => (store.delete(k) ? 1 : 0)), p),
    setex: (k: string, ttl: number, v: string) =>
      (ops.push(() => {
        store.set(k, v);
        ttls.set(k, ttl);
        return 'OK';
      }),
      p),
    exec: async () => {
      callCount += 1;
      return ops.map((op) => [null, op()]);
    },
  };
  return p;
}

const fakeRedis = {
  pipeline: () => makePipeline(),
  del: async (k: string) => {
    callCount += 1;
    return store.delete(k) ? 1 : 0;
  },
};

let redisReady = true;
jest.mock('../../shared/cache/redis', () => ({
  redisClient: {
    isReady: () => redisReady,
    getClient: () => fakeRedis,
  },
}));

const createSession = jest.fn(async (userId: string, tokenId: string) => {
  store.set(`session:${userId}:${tokenId}`, JSON.stringify({ userId, tokenId }));
});
jest.mock('../../shared/auth/session-manager', () => ({
  createSession: (...args: [string, string]) => createSession(...args),
}));

import {
  authStateKeys,
  checkAndTouchRequestAuth,
  resetAuthTouchCache,
} from '../../shared/auth/request-auth-state';

const meta = { ipAddress: '127.0.0.1' };

beforeEach(() => {
  store.clear();
  ttls.clear();
  callCount = 0;
  redisReady = true;
  createSession.mockClear();
  resetAuthTouchCache();
});

describe('checkAndTouchRequestAuth', () => {
  it('allows a normal token and creates its session once', async () => {
    await expect(checkAndTouchRequestAuth('u1', 't1', meta)).resolves.toEqual({ kind: 'ok' });
    expect(createSession).toHaveBeenCalledTimes(1);

    await expect(checkAndTouchRequestAuth('u1', 't1', meta)).resolves.toEqual({ kind: 'ok' });
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('uses one Redis round trip for a request inside the touch window', async () => {
    await checkAndTouchRequestAuth('u1', 't1', meta);
    callCount = 0;
    await checkAndTouchRequestAuth('u1', 't1', meta);
    expect(callCount).toBe(1);
  });

  it('refuses a revoked token on every request, even inside the touch window', async () => {
    await checkAndTouchRequestAuth('u1', 't1', meta);
    store.set(authStateKeys.blacklist('t1'), '1');
    await expect(checkAndTouchRequestAuth('u1', 't1', meta)).resolves.toEqual({ kind: 'revoked' });
  });

  it('refuses a locked account and reports when the lock ends', async () => {
    const lockedUntil = Date.now() + 10 * 60_000;
    store.set(authStateKeys.lockout('u1'), JSON.stringify({ lockedUntil }));
    await expect(checkAndTouchRequestAuth('u1', 't1', meta)).resolves.toEqual({
      kind: 'locked',
      lockedUntil,
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('removes an expired lock and lets the request through', async () => {
    store.set(authStateKeys.lockout('u1'), JSON.stringify({ lockedUntil: Date.now() - 1 }));
    await expect(checkAndTouchRequestAuth('u1', 't1', meta)).resolves.toEqual({ kind: 'ok' });
    expect(store.has(authStateKeys.lockout('u1'))).toBe(false);
  });

  it('clears failed attempts and refreshes session activity on the first request', async () => {
    store.set(authStateKeys.attempts('u1'), '3');
    store.set(authStateKeys.session('u1', 't1'), JSON.stringify({ userId: 'u1' }));
    ttls.set(authStateKeys.session('u1', 't1'), 500);

    await checkAndTouchRequestAuth('u1', 't1', meta);

    expect(store.has(authStateKeys.attempts('u1'))).toBe(false);
    const session = JSON.parse(store.get(authStateKeys.session('u1', 't1'))!);
    expect(typeof session.lastActivityAt).toBe('string');
    expect(ttls.get(authStateKeys.session('u1', 't1'))).toBe(500);
  });

  it('fails open (allows) when Redis is not ready, as before', async () => {
    redisReady = false;
    await expect(checkAndTouchRequestAuth('u1', 't1', meta)).resolves.toEqual({ kind: 'ok' });
  });
});
