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
import {
  base32Decode,
  base32Encode,
  currentStep,
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  totpCode,
  verifyTotp,
} from '../../modules/platform-admin/totp';
import {
  PLATFORM_CAPS,
  capsForRole,
  roleHasCap,
} from '../../modules/platform-admin/platform-admin-roles';

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

  it('carries the session version, and older tokens without it read as 0', () => {
    const { accessToken } = signPlatformAdminToken({ id: 'a', email: 'a@gates.com', sessionVersion: 3 });
    expect(verifyPlatformAdminToken(accessToken).sv).toBe(3);
    const legacy = signPlatformAdminToken({ id: 'a', email: 'a@gates.com' });
    expect(verifyPlatformAdminToken(legacy.accessToken).sv).toBe(0);
  });

  it('encrypts TOTP secrets so the stored value is not the secret', () => {
    const secret = generateTotpSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored)).toBe(secret);
  });
});

describe('TOTP (RFC 6238)', () => {
  // RFC 6238 appendix B, SHA-1 secret "12345678901234567890" at T=59s → 94287082 (8 digits) → 287082.
  const rfcSecret = base32Encode(Buffer.from('12345678901234567890'));

  it('matches the RFC 6238 test vector', () => {
    expect(totpCode(rfcSecret, Math.floor(59 / 30))).toBe('287082');
  });

  it('accepts the current code and one step of drift, rejects others', () => {
    const now = 1_700_000_000_000;
    const step = currentStep(now);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step), null, now)).toBe(step);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step - 3), null, now)).toBeNull();
    expect(verifyTotp(rfcSecret, 'abc123', null, now)).toBeNull();
  });

  it('refuses a code that was already used (replay)', () => {
    const now = 1_700_000_000_000;
    const step = currentStep(now);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step), step, now)).toBeNull();
  });

  it('round-trips base32', () => {
    const buf = Buffer.from('gates-admin-2fa');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });
});

describe('platform admin roles', () => {
  it('owner can do everything', () => {
    for (const cap of PLATFORM_CAPS) expect(roleHasCap('OWNER', cap)).toBe(true);
  });

  it('support cannot touch licenses, settings or admins', () => {
    expect(roleHasCap('SUPPORT', 'users.credentials')).toBe(true);
    expect(roleHasCap('SUPPORT', 'licenses.edit')).toBe(false);
    expect(roleHasCap('SUPPORT', 'settings.edit')).toBe(false);
    expect(roleHasCap('SUPPORT', 'admins.manage')).toBe(false);
    expect(roleHasCap('SUPPORT', 'users.delete')).toBe(false);
  });

  it('viewer has no write capability', () => {
    const writes = PLATFORM_CAPS.filter((c) => !c.endsWith('.view'));
    for (const cap of writes) expect(roleHasCap('VIEWER', cap)).toBe(false);
  });

  it('an unknown role gets nothing (fail closed)', () => {
    expect(capsForRole('SUPERUSER')).toEqual([]);
  });
});
