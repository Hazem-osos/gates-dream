/**
 * Platform admin panel — pure rules that protect tenants:
 *  - what a license row means right now (lockout window),
 *  - platform-admin tokens and tenant tokens never being interchangeable.
 */
import jwt from 'jsonwebtoken';
import { evaluateLicenseState } from '../../modules/platform-admin/services/platform-access.service';
import {
  signPlatformAdminToken,
  verifyPlatformAdminToken,
} from '../../modules/platform-admin/platform-admin-token';
import { env } from '../../shared/config/env';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-28T12:00:00Z');
const sub = (over: Partial<{ planType: string; status: string; startDate: Date | string; expiryDate: Date | string | null }>) => ({
  planType: 'SUBSCRIPTION',
  status: 'ACTIVE',
  startDate: new Date(now.getTime() - 10 * DAY),
  expiryDate: new Date(now.getTime() + 10 * DAY),
  ...over,
});

describe('evaluateLicenseState', () => {
  it('no subscription row stays unrestricted (existing contract)', () => {
    expect(evaluateLicenseState(null, now).state).toBe('UNLICENSED');
  });

  it('active subscription inside its window is ACTIVE', () => {
    expect(evaluateLicenseState(sub({}), now).state).toBe('ACTIVE');
  });

  it('subscription past its expiry is EXPIRED even if status still says ACTIVE', () => {
    expect(evaluateLicenseState(sub({ expiryDate: new Date(now.getTime() - DAY) }), now).state).toBe('EXPIRED');
  });

  it('LIFETIME never expires by date', () => {
    expect(
      evaluateLicenseState(sub({ planType: 'LIFETIME', expiryDate: new Date(now.getTime() - DAY) }), now).state
    ).toBe('ACTIVE');
  });

  it('a license that starts in the future is NOT_STARTED', () => {
    expect(evaluateLicenseState(sub({ startDate: new Date(now.getTime() + DAY) }), now).state).toBe('NOT_STARTED');
  });

  it('SUSPENDED and EXPIRED statuses block regardless of dates', () => {
    expect(evaluateLicenseState(sub({ status: 'SUSPENDED' }), now).state).toBe('SUSPENDED');
    expect(evaluateLicenseState(sub({ status: 'EXPIRED' }), now).state).toBe('EXPIRED');
  });

  it('TRIAL inside its window is usable', () => {
    expect(evaluateLicenseState(sub({ status: 'TRIAL' }), now).state).toBe('TRIAL');
  });

  it('accepts dates serialized as strings (values come back from the JSON cache)', () => {
    const s = sub({});
    expect(
      evaluateLicenseState(
        { ...s, startDate: (s.startDate as Date).toISOString(), expiryDate: new Date(now.getTime() - DAY).toISOString() },
        now
      ).state
    ).toBe('EXPIRED');
  });
});

describe('platform admin tokens', () => {
  const hadSecret = env.JWT_DEV_SECRET;
  beforeAll(() => {
    (env as { JWT_DEV_SECRET?: string }).JWT_DEV_SECRET = hadSecret ?? 'test-dev-secret-at-least-16-chars';
  });
  afterAll(() => {
    (env as { JWT_DEV_SECRET?: string }).JWT_DEV_SECRET = hadSecret;
  });

  it('round-trips an admin token', () => {
    const { accessToken } = signPlatformAdminToken({ id: 'admin-1', email: 'a@gates.com' });
    expect(verifyPlatformAdminToken(accessToken)).toMatchObject({ sub: 'admin-1', email: 'a@gates.com' });
  });

  it('a tenant token (signed with JWT_DEV_SECRET) is rejected as an admin token', () => {
    const tenantToken = jwt.sign(
      { sub: 'user-1', email: 'u@x.com', typ: 'platform_admin', aud: 'gates-platform-admin' },
      env.JWT_DEV_SECRET!,
      { algorithm: 'HS256' }
    );
    expect(() => verifyPlatformAdminToken(tenantToken)).toThrow();
  });

  it('an admin token does not verify with the tenant secret', () => {
    const { accessToken } = signPlatformAdminToken({ id: 'admin-1', email: 'a@gates.com' });
    expect(() => jwt.verify(accessToken, env.JWT_DEV_SECRET!, { algorithms: ['HS256'] })).toThrow();
  });
});
