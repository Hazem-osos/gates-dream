/**
 * Phase 5.1 Wave B.5 — serialized JSON must not leak payroll amounts without permission.
 */
import express from 'express';
import type { AddressInfo } from 'net';
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { runPayrollMonth } from '../helpers/hcm-payroll-wave-a3.helpers';

const prisma = new PrismaClient();
const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;

let tenantCompanyId = '00000000-0000-4000-8000-000000010001';
let permissions: Array<{ resource: string; action: string; allow: boolean; module: string; branchId: null }> =
  [];

jest.mock('../../shared/middleware/auth.middleware', () => ({
  authenticate: (req: any, _r: unknown, next: (err?: unknown) => void) => {
    if (!req.headers.authorization) {
      const { AppError } = jest.requireActual('../../shared/middleware/error-handler');
      return next(new AppError(401, 'Authentication required'));
    }
    req.user = { sub: 'b5-field-user' };
    next();
  },
}));
jest.mock('../../shared/middleware/tenant.middleware', () => ({
  setTenantContext: (req: any, _r: unknown, next: () => void) => {
    req.companyId = tenantCompanyId;
    req.tenantId = tenantCompanyId;
    next();
  },
}));
jest.mock('../../shared/cache/tenant-context.cache', () => ({
  getCachedUserPermissions: async () => ({ grantAll: false, permissions }),
  permissionGrantedFromCache: (
    cached: { grantAll: boolean; permissions: typeof permissions },
    resource: string,
    action: string
  ) => {
    if (cached.grantAll) return true;
    return cached.permissions.some(
      (p) => p.allow && p.resource === resource && p.action === action
    );
  },
}));

import employeeRoutes from '../../modules/hr/routes/employee.routes';
import hcmPayrollRoutes from '../../modules/hr/routes/hcm-payroll.routes';
import payrollRunRoutes from '../../modules/hr/routes/payroll-run.routes';
import { errorHandler } from '../../shared/middleware/error-handler';

function authHeaders() {
  return { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
}

function jsonHasPositiveAmount(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value > 0;
  if (Array.isArray(value)) return value.some(jsonHasPositiveAmount);
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([k, v]) => {
      if (k === 'amountsRedacted' || k === 'pagination') return false;
      if (['amount', 'basicSalary', 'grossSalary', 'netSalary', 'totalGross', 'totalNet'].includes(k)) {
        return typeof v === 'number' && v > 0;
      }
      return jsonHasPositiveAmount(v);
    });
  }
  return false;
}

describeDb('HCM Phase 5.1 Wave B.5 field security HTTP', () => {
  jest.setTimeout(120_000);
  let baseUrl: string;
  let server: ReturnType<typeof express.application.listen>;
  let fx: Awaited<ReturnType<typeof createPayrollFixture>>;
  let runId: string;

  beforeAll(async () => {
    fx = await createPayrollFixture(prisma);
    tenantCompanyId = fx.companyId;
    const run = await runPayrollMonth(prisma, fx, 10);
    runId = run.id;

    const app = express();
    app.use(express.json());
    app.use('/api/v1/hr/employees', employeeRoutes);
    app.use('/api/v1/hr/payroll', hcmPayrollRoutes);
    app.use('/api/v1/hr/payroll-runs', payrollRunRoutes);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    permissions = [];
  });

  it('employee list redacts salary fields with employee:view only', async () => {
    permissions = [{ resource: 'employee', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/employees?limit=5`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.amountsRedacted).toBe(true);
    const row = (body.data as Array<Record<string, unknown>>)?.[0];
    expect(row?.basicSalary).toBeNull();
    expect(jsonHasPositiveAmount(body)).toBe(false);
  });

  it('employee detail redacts without compensation/payroll view', async () => {
    permissions = [{ resource: 'employee', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/employees/${fx.employeeId}`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.basicSalary).toBeNull();
    expect(body.data.amountsRedacted).toBe(true);
  });

  it('run review exposes amounts only with payroll:view', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll/runs/${runId}/review`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.run.gross).toBeGreaterThan(0);
    expect(body.data.amountsRedacted).toBe(false);
  });

  it('payslip returns amounts with payroll:view', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(
      `${baseUrl}/api/v1/hr/payroll/runs/${runId}/payslip/${fx.employeeId}`,
      { headers: authHeaders() }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Number(body.data.grossSalary)).toBeGreaterThan(0);
  });

  it('dashboard metrics null without payroll:view', async () => {
    permissions = [];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll/dashboard/metrics`, { headers: authHeaders() });
    expect(res.status).toBe(403);
  });

  it('dashboard metrics with payroll:view', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll/dashboard/metrics`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.gross).toBeGreaterThan(0);
  });

  it('unauthenticated employee list returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hr/employees`);
    expect(res.status).toBe(401);
  });

  it('run review redacts amounts without payroll:view', async () => {
    permissions = [];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll/runs/${runId}/review`, { headers: authHeaders() });
    expect(res.status).toBe(403);
  });

  it('payroll run GET redacts without payroll:view', async () => {
    permissions = [];
    const res = await fetch(`${baseUrl}/api/v1/hr/payroll-runs/${runId}`, { headers: authHeaders() });
    expect(res.status).toBe(403);
  });

  it('foreign run id returns 404', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const res = await fetch(
      `${baseUrl}/api/v1/hr/payroll-runs/00000000-0000-4000-8000-000000000099`,
      { headers: authHeaders() }
    );
    expect(res.status).toBe(404);
  });
});
