/**
 * Security: POST /auth/register attaches the new user to an existing company (the oldest
 * active one by default). In production that is a real customer, so it must stay closed
 * unless ALLOW_PUBLIC_REGISTRATION is set explicitly.
 */
const createUser = jest.fn();
const companyFindFirst = jest.fn();

const mockEnv: Record<string, unknown> = {
  NODE_ENV: 'production',
  JWT_DEV_SECRET: 'x'.repeat(32),
  KEYCLOAK_ENABLED: false,
  ALLOW_PUBLIC_REGISTRATION: false,
};

jest.mock('../../shared/config/env', () => ({ env: mockEnv }));
jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    company: { findFirst: (...a: unknown[]) => companyFindFirst(...a), findUnique: jest.fn() },
  },
}));
jest.mock('../../shared/services/email.service', () => ({ emailService: { sendEmail: jest.fn() } }));
jest.mock('../../modules/users/services/user.service', () => ({
  userService: { createUser: (...a: unknown[]) => createUser(...a) },
}));
jest.mock('../../modules/accounting/services/tenant-provisioning.service', () => ({
  tenantProvisioningService: { provisionStandardTenant: jest.fn() },
}));
jest.mock('../../shared/config/prod-seed', () => ({ refuseProductionSeed: () => true }));
jest.mock('../../shared/cache/redis', () => ({
  redisClient: { isReady: () => false, getClient: jest.fn() },
}));
jest.mock('../../modules/platform-admin/services/platform-access.service', () => ({
  assertLoginAllowed: jest.fn(async () => undefined),
}));
jest.mock('../../shared/security/account-lockout', () => ({
  clearFailedAttempts: jest.fn(),
  isAccountLocked: jest.fn(async () => null),
  recordFailedAttempt: jest.fn(),
}));

import { authService } from '../../modules/auth/services/auth.service';

const body = { email: 'a@b.co', username: 'stranger', password: 'Passw0rd!x' } as Parameters<
  typeof authService.register
>[0];

beforeEach(() => {
  createUser.mockReset();
  companyFindFirst.mockReset();
  companyFindFirst.mockResolvedValue({ id: 'real-customer' });
  createUser.mockResolvedValue({ id: 'u1', email: 'a@b.co', username: 'stranger', companyId: 'real-customer' });
  mockEnv.NODE_ENV = 'production';
  mockEnv.ALLOW_PUBLIC_REGISTRATION = false;
});

describe('register in production', () => {
  it('is refused with 403 and creates no user', async () => {
    await expect(authService.register(body)).rejects.toMatchObject({ statusCode: 403 });
    expect(createUser).not.toHaveBeenCalled();
    expect(companyFindFirst).not.toHaveBeenCalled();
  });

  it('works only when ALLOW_PUBLIC_REGISTRATION is set', async () => {
    mockEnv.ALLOW_PUBLIC_REGISTRATION = true;
    await expect(authService.register(body)).resolves.toMatchObject({ user: { id: 'u1' } });
    expect(createUser).toHaveBeenCalled();
  });

  it('still works in development', async () => {
    mockEnv.NODE_ENV = 'development';
    await expect(authService.register(body)).resolves.toMatchObject({ user: { id: 'u1' } });
  });
});
