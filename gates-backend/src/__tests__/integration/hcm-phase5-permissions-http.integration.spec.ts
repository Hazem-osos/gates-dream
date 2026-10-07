/**
 * Phase 5.1 Wave A.3 — payroll HTTP authorization.
 */
import express from 'express';
import type { AddressInfo } from 'net';

const mockCompanyId = '00000000-0000-4000-8000-000000010001';
const mockUserId = 'payroll-http-user';
let permissions: Array<{ resource: string; action: string; allow: boolean; module: string; branchId: null }> = [];

jest.mock('../../shared/middleware/auth.middleware', () => ({
  authenticate: (req: any, _r: unknown, next: (err?: unknown) => void) => {
    if (!req.headers.authorization) {
      const { AppError } = jest.requireActual('../../shared/middleware/error-handler');
      return next(new AppError(401, 'Authentication required'));
    }
    req.user = { sub: mockUserId };
    next();
  },
}));
jest.mock('../../shared/middleware/tenant.middleware', () => ({
  setTenantContext: (req: any, _r: unknown, next: () => void) => {
    req.companyId = mockCompanyId;
    req.tenantId = mockCompanyId;
    req.fiscalYearId = req.headers['x-fiscal-year-id'] ?? undefined;
    req.branchId = req.headers['x-branch-id'] ?? undefined;
    next();
  },
}));
jest.mock('../../shared/cache/tenant-context.cache', () => ({
  getCachedUserPermissions: async () => ({
    grantAll: false,
    permissions,
  }),
  permissionGrantedFromCache: (cached: { grantAll: boolean; permissions: typeof permissions }, resource: string, action: string) => {
    if (cached.grantAll) return true;
    return cached.permissions.some(
      (p) => p.allow && p.resource === resource && p.action === action
    );
  },
}));

import payrollRunRoutes from '../../modules/hr/routes/payroll-run.routes';
import hcmPayrollRoutes from '../../modules/hr/routes/hcm-payroll.routes';
import { errorHandler } from '../../shared/middleware/error-handler';

describe('HCM Phase 5.1 payroll HTTP permissions', () => {
  jest.setTimeout(30_000);
  let baseUrl: string;
  let server: ReturnType<typeof express.application.listen>;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/hr/payroll-runs', payrollRunRoutes);
    app.use('/api/v1/hr/payroll', hcmPayrollRoutes);
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

  beforeEach(() => {
    permissions = [];
  });

  function authHeaders(extra: Record<string, string> = {}) {
    return { Authorization: 'Bearer test', 'Content-Type': 'application/json', ...extra };
  }

  it('unauthenticated calculate returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodYear: 2026, periodMonth: 1 }),
    });
    expect(res.status).toBe(401);
  });

  it('authenticated without payroll:calculate returns 403', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll-runs`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ periodYear: 2026, periodMonth: 1 }),
    });
    expect(res.status).toBe(403);
  });

  it('payroll:view allows GET run', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll-runs/00000000-0000-4000-8000-000000000099`, {
      headers: authHeaders(),
    });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('payroll:approve required for approve route', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll-runs/x/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(403);
  });

  it('payroll:post required for post-accrual', async () => {
    permissions = [
      { resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null },
      { resource: 'payroll', action: 'edit', allow: true, module: 'hr', branchId: null },
    ];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll-runs/x/post-accrual`, {
      method: 'POST',
      headers: authHeaders({ 'X-Fiscal-Year-Id': 'fy' }),
    });
    expect(res.status).toBe(403);
  });

  it('payroll:pay required for disburse', async () => {
    permissions = [{ resource: 'payroll', action: 'post', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll-runs/x/disburse`, {
      method: 'POST',
      headers: authHeaders({ 'X-Fiscal-Year-Id': 'fy' }),
      body: JSON.stringify({ safeId: 's' }),
    });
    expect(res.status).toBe(403);
  });

  it('payroll:gl_manage required for component GL patch', async () => {
    permissions = [{ resource: 'payroll', action: 'edit', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll/components/x/gl`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ glExpenseAccountId: 'a' }),
    });
    expect(res.status).toBe(403);
  });

  it('payroll:localization_manage required for localization POST', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'DEFAULT',
        effectiveFrom: '2026-01-01',
        config: { insuranceCap: 1 },
      }),
    });
    expect(res.status).toBe(403);
  });

  it('reports without payroll:view amounts returns 403', async () => {
    permissions = [];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll/runs/x/reports/summary`, {
      headers: authHeaders(),
    });
    expect(res.status).toBe(403);
  });

  it('authorized payroll:calculate passes auth gate', async () => {
    permissions = [{ resource: 'payroll', action: 'calculate', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll-runs`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ periodYear: 2026, periodMonth: 1 }),
    });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
