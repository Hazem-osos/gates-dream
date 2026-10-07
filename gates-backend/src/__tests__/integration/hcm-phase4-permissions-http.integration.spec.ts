import express from 'express';
import type { AddressInfo } from 'net';

const mockCompanyId = '00000000-0000-4000-8000-000000000098';

jest.mock('../../shared/middleware/auth.middleware', () => ({
  authenticate: (req: any, _r: unknown, next: () => void) => {
    req.user = { sub: 'leave-http-user' };
    next();
  },
}));
jest.mock('../../shared/middleware/tenant.middleware', () => ({
  setTenantContext: (req: any, _r: unknown, next: () => void) => {
    req.companyId = mockCompanyId;
    req.tenantId = mockCompanyId;
    next();
  },
}));
const mockPerms = { grantAll: false, permissions: [{ resource: 'leave', action: 'view', allow: true, module: 'hr', branchId: null }] };
jest.mock('../../shared/cache/tenant-context.cache', () => {
  const actual = jest.requireActual('../../shared/cache/tenant-context.cache');
  return {
    ...actual,
    getCachedUserPermissions: async () => mockPerms,
  };
});

import hcmLeaveRoutes from '../../modules/hr/routes/hcm-leave.routes';
import { errorHandler } from '../../shared/middleware/error-handler';

describe('HCM leave HTTP permissions smoke', () => {
  jest.setTimeout(20_000);
  let baseUrl: string;
  let server: ReturnType<typeof express.application.listen>;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.company.upsert({
      where: { id: mockCompanyId },
      create: { id: mockCompanyId, arabicName: 'Leave HTTP Co', isActive: true },
      update: {},
    });
    await prisma.$disconnect();

    const app = express();
    app.use(express.json());
    app.use('/api/v1/hr/leave', hcmLeaveRoutes);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('view can read types', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hr/leave/types`);
    expect(res.status).toBe(200);
  });

  it('view cannot approve', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hr/leave/requests/x/approve`, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('view cannot adjust', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hr/leave/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credit: true, quantity: 1, employmentId: 'x', leaveTypeId: 'y', effectiveDate: '2026-01-01' }),
    });
    expect(res.status).toBe(403);
  });

  it('view cannot access inbox (approve capability)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hr/leave/requests/inbox`);
    expect(res.status).toBe(403);
  });
});
