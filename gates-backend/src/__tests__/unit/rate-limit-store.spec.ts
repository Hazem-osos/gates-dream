/**
 * The shared rate-limit store must count across processes (Redis) and fall back
 * to per-process counting when Redis is down — never fail open or block.
 */
const counters = new Map<string, number>();
let redisReady = true;
let evalFails = false;

const fakeRedis = {
  eval: jest.fn(async (_script: string, _n: number, key: string, windowMs: string) => {
    if (evalFails) throw new Error('redis down');
    const hits = (counters.get(key) ?? 0) + 1;
    counters.set(key, hits);
    return [hits, Number(windowMs)];
  }),
  decr: jest.fn(async (key: string) => {
    counters.set(key, (counters.get(key) ?? 0) - 1);
  }),
  del: jest.fn(async (key: string) => {
    counters.delete(key);
  }),
};

jest.mock('../../shared/cache/redis', () => ({
  redisClient: {
    isReady: () => redisReady,
    getClient: () => fakeRedis,
  },
}));

import type { Options } from 'express-rate-limit';
import { SharedRateLimitStore } from '../../shared/middleware/rate-limit-store';

const opts = { windowMs: 60_000 } as Options;

beforeEach(() => {
  counters.clear();
  redisReady = true;
  evalFails = false;
  jest.clearAllMocks();
});

describe('SharedRateLimitStore', () => {
  it('two stores with the same prefix share one counter (two processes)', async () => {
    const a = new SharedRateLimitStore('auth');
    const b = new SharedRateLimitStore('auth');
    a.init(opts);
    b.init(opts);

    await a.increment('1.2.3.4');
    await b.increment('1.2.3.4');
    const third = await a.increment('1.2.3.4');

    expect(third.totalHits).toBe(3);
    expect(counters.get('rl:auth:1.2.3.4')).toBe(3);
  });

  it('different limiters do not share counters', async () => {
    const auth = new SharedRateLimitStore('auth');
    const api = new SharedRateLimitStore('api');
    auth.init(opts);
    api.init(opts);
    await auth.increment('ip');
    const apiHit = await api.increment('ip');
    expect(apiHit.totalHits).toBe(1);
  });

  it('returns a reset time inside the window', async () => {
    const s = new SharedRateLimitStore('api');
    s.init(opts);
    const before = Date.now();
    const { resetTime } = await s.increment('ip');
    expect(resetTime!.getTime()).toBeGreaterThanOrEqual(before + 59_000);
  });

  it('decrement and resetKey act on the shared counter', async () => {
    const s = new SharedRateLimitStore('auth');
    s.init(opts);
    await s.increment('ip');
    await s.increment('ip');
    await s.decrement('ip');
    expect(counters.get('rl:auth:ip')).toBe(1);
    await s.resetKey('ip');
    expect(counters.has('rl:auth:ip')).toBe(false);
  });

  it('falls back to per-process counting when Redis is not ready', async () => {
    redisReady = false;
    const s = new SharedRateLimitStore('auth');
    s.init(opts);
    await s.increment('ip');
    const second = await s.increment('ip');
    expect(second.totalHits).toBe(2);
    expect(fakeRedis.eval).not.toHaveBeenCalled();
  });

  it('falls back when a Redis call throws', async () => {
    evalFails = true;
    const s = new SharedRateLimitStore('auth');
    s.init(opts);
    const first = await s.increment('ip');
    expect(first.totalHits).toBe(1);
  });
});
