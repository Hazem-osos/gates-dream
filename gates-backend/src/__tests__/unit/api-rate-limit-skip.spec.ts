/**
 * The general API limiter must never put every user behind one bucket: when the real
 * client IP is unknown (only the proxy's private address is visible), it does not count.
 */
jest.mock('../../shared/middleware/rate-limit-store', () => ({
  SharedRateLimitStore: class {
    init() {}
    async increment() {
      return { totalHits: 1, resetTime: new Date() };
    }
    async decrement() {}
    async resetKey() {}
  },
}));

import type { Request } from 'express';
import { skipApiRateLimit } from '../../shared/middleware/rate-limit.middleware';

function req(headers: Record<string, string>, url = '/api/v1/customers', ip = '10.0.0.5'): Request {
  return { headers, originalUrl: url, path: url, ip, socket: { remoteAddress: ip } } as unknown as Request;
}

describe('skipApiRateLimit', () => {
  it('counts a request with a real public client IP', () => {
    expect(skipApiRateLimit(req({ 'x-forwarded-for': '41.33.10.2' }))).toBe(false);
  });

  it('does not count when only the shared proxy address is known', () => {
    expect(skipApiRateLimit(req({}))).toBe(true);
    expect(skipApiRateLimit(req({ 'x-forwarded-for': '10.1.2.3' }))).toBe(true);
  });

  it('leaves login/session bootstrap paths to their own limiter', () => {
    expect(skipApiRateLimit(req({ 'x-forwarded-for': '41.33.10.2' }, '/api/v1/auth/login'))).toBe(true);
  });
});
