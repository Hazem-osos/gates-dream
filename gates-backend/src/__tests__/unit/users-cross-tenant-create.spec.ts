/**
 * Regression: a company admin must not create users or user groups inside another company by
 * putting that company's id in the request body. The company always comes from the token.
 */
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';

const createUser = jest.fn(async (data: { companyId: string }) => ({ id: 'u-new', companyId: data.companyId }));
const createUserGroup = jest.fn(async (data: { companyId: string }) => ({ id: 'g-new', companyId: data.companyId }));

jest.mock('../../shared/middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { sub: 'admin-of-a', company_id: COMPANY_A };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../shared/middleware/tenant.middleware', () => ({
  setTenantContext: (req: any, _res: any, next: any) => {
    req.companyId = COMPANY_A;
    req.tenantId = COMPANY_A;
    next();
  },
}));
jest.mock('../../shared/middleware/authorize.middleware', () => ({
  authorize: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../modules/users/services/user.service', () => ({ userService: { createUser } }));
jest.mock('../../modules/users/services/user-group.service', () => ({ userGroupService: { createUserGroup } }));

import userRoutes from '../../modules/users/routes/user.routes';
import userGroupRoutes from '../../modules/users/routes/user-group.routes';

let server: Server;
let base = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/users', userRoutes);
  app.use('/user-groups', userGroupRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  createUser.mockClear();
  createUserGroup.mockClear();
});

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const newUser = (companyId: string) => ({
  companyId,
  email: 'someone@example.com',
  username: 'someone_1',
  password: 'Password123',
});

describe('POST /users — company comes from the token', () => {
  it('refuses another company id in the body', async () => {
    const res = await post('/users', newUser(COMPANY_B));
    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates the user in the signed-in company', async () => {
    const res = await post('/users', newUser(COMPANY_A));
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_A }));
  });
});

describe('POST /user-groups — company comes from the token', () => {
  it('refuses another company id in the body', async () => {
    const res = await post('/user-groups', { companyId: COMPANY_B, arabicName: 'مجموعة' });
    expect(res.status).toBe(403);
    expect(createUserGroup).not.toHaveBeenCalled();
  });

  it('creates the group in the signed-in company', async () => {
    const res = await post('/user-groups', { companyId: COMPANY_A, arabicName: 'مجموعة' });
    expect(res.status).toBe(201);
    expect(createUserGroup).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_A }));
  });
});
