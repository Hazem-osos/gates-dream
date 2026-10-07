/**
 * Lightweight HTTP smoke for attendance auth wiring (full matrix in attendance-authorize-middleware.spec.ts).
 */
import express from 'express';
import type { AddressInfo } from 'net';

const mockCompanyId = '00000000-0000-4000-8000-000000000099';

jest.mock('../../shared/middleware/auth.middleware', () => ({
  authenticate: (req: any, _r: unknown, next: () => void) => {
    req.user = { sub: 'http-user' };
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
jest.mock('../../shared/cache/tenant-context.cache', () => {
  const actual = jest.requireActual('../../shared/cache/tenant-context.cache');
  return {
    ...actual,
    getCachedUserPermissions: async () => ({
      grantAll: false,
      permissions: [{ resource: 'attendance', action: 'view', allow: true, module: 'hr', branchId: null }],
    }),
  };
});

import hcmTimeRoutes from '../../modules/hr/routes/hcm-time.routes';
import { errorHandler } from '../../shared/middleware/error-handler';

describe('HCM time HTTP smoke', () => {
  jest.setTimeout(20_000);
  let baseUrl: string;
  let server: ReturnType<typeof express.application.listen>;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.company.upsert({
      where: { id: mockCompanyId },
      create: { id: mockCompanyId, arabicName: 'HTTP Perm Co', isActive: true },
      update: {},
    });
    await prisma.$disconnect();

    const app = express();
    app.use(express.json());
    app.use('/api/v1/hr/time', hcmTimeRoutes);
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

  it('returns 403 for manage without permission', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hr/time/punches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ punchedAt: new Date().toISOString() }),
    });
    expect(res.status).toBe(403);
  });
});
