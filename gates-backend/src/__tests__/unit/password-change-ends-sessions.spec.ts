/**
 * Security: access tokens live 30 days. A token issued before a password change must stop
 * working on the next tenant request (stolen or shared token), with no schema change: the
 * token carries a fingerprint of the password hash (`pv`) that is compared per request.
 */
const userFindUnique = jest.fn();

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    company: {
      findUnique: jest.fn(async () => ({ isActive: true, deletedAt: null, tenantSubscription: null })),
    },
  },
}));
jest.mock('../../shared/cache/tenant-metadata-cache', () => ({
  getTenantCached: async (_k: string, loader: () => Promise<unknown>) => loader(),
  invalidateTenantCache: jest.fn(),
}));
jest.mock('../../modules/platform-admin/services/platform-settings.service', () => ({
  getPlatformSettings: async () => ({ maintenance: { enabled: false, message: '' } }),
}));
jest.mock('../../shared/config/env', () => ({ env: { KEYCLOAK_ENABLED: false } }));

import { assertTenantRequestAllowed } from '../../modules/platform-admin/services/platform-access.service';
import { isTokenFromOldPassword, passwordVersion } from '../../shared/auth/password-version';

const OLD_HASH = '$2a$10$oldoldoldoldoldoldoldoOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDO';
const NEW_HASH = '$2a$10$newnewnewnewnewnewnewnNEWNEWNEWNEWNEWNEWNEWNEWNEWNEWN';

function check(pv: string | undefined) {
  return assertTenantRequestAllowed({ companyId: 'co-a', userId: 'u1', checkUser: true, passwordVersion: pv });
}

describe('passwordVersion', () => {
  it('is a short fingerprint that never contains the hash', () => {
    const pv = passwordVersion(OLD_HASH)!;
    expect(pv).toMatch(/^[0-9a-f]{16}$/);
    expect(OLD_HASH).not.toContain(pv);
    expect(passwordVersion(OLD_HASH)).toBe(pv);
    expect(passwordVersion(NEW_HASH)).not.toBe(pv);
    expect(passwordVersion(undefined)).toBeUndefined();
  });

  it('only judges tokens that carry a version', () => {
    expect(isTokenFromOldPassword(undefined, 'abc')).toBe(false);
    expect(isTokenFromOldPassword('abc', undefined)).toBe(false);
    expect(isTokenFromOldPassword('abc', 'abc')).toBe(false);
    expect(isTokenFromOldPassword('abc', 'def')).toBe(true);
  });
});

describe('tenant request after a password change', () => {
  beforeEach(() => userFindUnique.mockReset());

  it('allows a token issued with the current password', async () => {
    userFindUnique.mockResolvedValue({ isActive: true, passwordHash: OLD_HASH });
    await expect(check(passwordVersion(OLD_HASH))).resolves.toBeUndefined();
  });

  it('rejects a token issued before the password changed with 401', async () => {
    userFindUnique.mockResolvedValue({ isActive: true, passwordHash: NEW_HASH });
    await expect(check(passwordVersion(OLD_HASH))).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_PASSWORD_CHANGED',
    });
  });

  it('keeps older tokens without a version working (no forced logout on deploy)', async () => {
    userFindUnique.mockResolvedValue({ isActive: true, passwordHash: NEW_HASH });
    await expect(check(undefined)).resolves.toBeUndefined();
  });

  it('still blocks a disabled user first', async () => {
    userFindUnique.mockResolvedValue({ isActive: false, passwordHash: OLD_HASH });
    await expect(check(passwordVersion(OLD_HASH))).rejects.toMatchObject({ code: 'USER_DISABLED' });
  });
});
