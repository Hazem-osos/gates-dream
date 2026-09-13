import { buildHttpCacheKey, shouldCacheHttpGet } from '../../shared/cache/cache-key.util';
import type { AuthRequest } from '../../shared/auth/types';

function mockReq(partial: Partial<AuthRequest> & { originalUrl?: string }): AuthRequest {
  return {
    method: 'GET',
    url: partial.originalUrl ?? '/api/v1/accounting/accounts',
    originalUrl: partial.originalUrl ?? '/api/v1/accounting/accounts',
    query: {},
    headers: {},
    ...partial,
  } as AuthRequest;
}

describe('buildHttpCacheKey', () => {
  it('produces different keys for different company ids', () => {
    const a = buildHttpCacheKey(
      mockReq({
        companyId: 'company-a',
        user: { sub: 'u1', email: 'a@x.com', username: 'a' },
        headers: { authorization: 'Bearer token-a' },
      })
    );
    const b = buildHttpCacheKey(
      mockReq({
        companyId: 'company-b',
        user: { sub: 'u1', email: 'a@x.com', username: 'a' },
        headers: { authorization: 'Bearer token-b' },
      })
    );
    expect(a).not.toBe(b);
  });

  it('produces different keys for different users in same company', () => {
    const a = buildHttpCacheKey(
      mockReq({
        companyId: 'company-a',
        user: { sub: 'u1', email: 'a@x.com', username: 'a' },
      })
    );
    const b = buildHttpCacheKey(
      mockReq({
        companyId: 'company-a',
        user: { sub: 'u2', email: 'b@x.com', username: 'b' },
      })
    );
    expect(a).not.toBe(b);
  });
});

describe('shouldCacheHttpGet', () => {
  it('skips /users/me', () => {
    expect(
      shouldCacheHttpGet(mockReq({ originalUrl: '/api/v1/users/me' }))
    ).toBe(false);
  });

  it('allows tenant metadata routes', () => {
    expect(
      shouldCacheHttpGet(mockReq({ originalUrl: '/api/v1/accounting/accounts?page=1' }))
    ).toBe(true);
  });
});
