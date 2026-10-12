/**
 * Phase 5.1 Wave B.8 — localization validation HTTP lifecycle (TEST configs).
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
    req.user = { sub: 'b8-loc-admin' };
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

import hcmPayrollRoutes from '../../modules/hr/routes/hcm-payroll.routes';
import { errorHandler } from '../../shared/middleware/error-handler';

function authHeaders() {
  return { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
}

function adminPerms() {
  return [
    { resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null },
    { resource: 'payroll', action: 'localization_manage', allow: true, module: 'hr', branchId: null },
  ];
}

describeDb('HCM Phase 5.1 Wave B.8 localization HTTP', () => {
  jest.setTimeout(120_000);
  let baseUrl: string;
  let server: ReturnType<typeof express.application.listen>;
  let fx: Awaited<ReturnType<typeof createPayrollFixture>>;

  beforeAll(async () => {
    fx = await createPayrollFixture(prisma);
    tenantCompanyId = fx.companyId;
    const app = express();
    app.use(express.json());
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
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    permissions = adminPerms();
  });

  it('validates and creates INSURANCE_CAP with readback and audit', async () => {
    const suffix = Date.now();
    const effectiveFrom = `2026-04-${String((suffix % 27) + 1).padStart(2, '0')}`;

    const valRes = await fetch(`${baseUrl}/api/v1/hr/payroll/localization/validate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        config: { maxBase: 12000 },
      }),
    });
    expect(valRes.status).toBe(200);
    const val = await valRes.json();
    expect(val.data.valid).toBe(true);

    const createRes = await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom,
        effectiveTo: '2026-12-31',
        config: { maxBase: 12000 },
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const id = created.data.id as string;

    const detailRes = await fetch(`${baseUrl}/api/v1/hr/payroll/localization/detail/${id}`, {
      headers: authHeaders(),
    });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.data.config.maxBase).toBe(12000);

    const versionsRes = await fetch(
      `${baseUrl}/api/v1/hr/payroll/localization/EG/INSURANCE_CAP/versions`,
      { headers: authHeaders() }
    );
    expect(versionsRes.status).toBe(200);
    const versions = await versionsRes.json();
    expect(versions.data.some((r: { id: string }) => r.id === id)).toBe(true);

    const auditRes = await fetch(
      `${baseUrl}/api/v1/hr/payroll/config-audit?subjectType=HCM_PAYROLL_LOCALIZATION&limit=5`,
      { headers: authHeaders() }
    );
    expect(auditRes.status).toBe(200);
    const audit = await auditRes.json();
    expect(audit.data.some((a: { subjectId: string }) => a.subjectId === id)).toBe(true);
  });

  it('rejects negative cap, bad brackets, and overlapping periods', async () => {
    const badVal = await fetch(`${baseUrl}/api/v1/hr/payroll/localization/validate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        config: { maxBase: -5 },
      }),
    });
    const badBody = await badVal.json();
    expect(badBody.data.valid).toBe(false);

    const bracketVal = await fetch(`${baseUrl}/api/v1/hr/payroll/localization/validate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'TAX_BRACKETS',
        config: { brackets: [{ upTo: 1000, rate: 0.1 }, { upTo: 500, rate: 0.2 }] },
      }),
    });
    const bracketBody = await bracketVal.json();
    expect(bracketBody.data.valid).toBe(false);

    const from = '2026-05-01';
    const first = await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'TAX_BRACKETS',
        effectiveFrom: from,
        effectiveTo: '2026-12-31',
        config: { brackets: [{ upTo: 10000, rate: 0.1 }, { rate: 0.15 }] },
      }),
    });
    expect(first.status).toBe(201);

    const overlap = await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'TAX_BRACKETS',
        effectiveFrom: '2026-06-01',
        config: { brackets: [{ rate: 0.2 }] },
      }),
    });
    expect(overlap.status).toBe(422);

    const dates = await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-07-01',
        config: { maxBase: 1 },
      }),
    });
    expect(dates.status).toBe(422);
  });

  it('allows non-overlapping config keys on same dates', async () => {
    const day = `2030-06-${String((Date.now() % 27) + 1).padStart(2, '0')}`;
    const cap = await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: day,
        effectiveTo: '2030-06-30',
        config: { maxBase: 9000 },
      }),
    });
    expect(cap.status).toBe(201);
    const brackets = await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'TAX_BRACKETS',
        effectiveFrom: day,
        effectiveTo: '2030-06-30',
        config: { brackets: [{ rate: 0.05 }] },
      }),
    });
    expect(brackets.status).toBe(201);
  });

  it('keeps frozen payroll line amounts after future localization change', async () => {
    const capFrom = '2026-01-01';
    await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: capFrom,
        effectiveTo: '2026-12-31',
        config: { maxBase: 8000 },
      }),
    });

    const run = await runPayrollMonth(prisma, fx, 1);
    const lines = await prisma.hcmPayrollItemComponent.findMany({
      where: { payrollRunItem: { payrollRunId: run.id } },
      select: { id: true, componentCode: true, amount: true },
    });
    const snapshot = JSON.stringify(lines.map((l) => ({ c: l.componentCode, a: l.amount })).sort());

    await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: '2027-01-01',
        config: { maxBase: 500 },
      }),
    });

    const linesAfter = await prisma.hcmPayrollItemComponent.findMany({
      where: { payrollRunItem: { payrollRunId: run.id } },
      select: { id: true, componentCode: true, amount: true },
    });
    const after = JSON.stringify(linesAfter.map((l) => ({ c: l.componentCode, a: l.amount })).sort());
    expect(after).toBe(snapshot);
  });

  it('enforces permissions and tenant isolation', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const forbidden = await fetch(`${baseUrl}/api/v1/hr/payroll/localization`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: '2026-02-01',
        config: { maxBase: 1 },
      }),
    });
    expect(forbidden.status).toBe(403);

    permissions = adminPerms();
    const otherFx = await createPayrollFixture(prisma);
    const foreign = await prisma.hcmPayrollLocalizationConfig.create({
      data: {
        companyId: otherFx.companyId,
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: new Date(`2032-03-${String((Date.now() % 27) + 1).padStart(2, '0')}`),
        configJson: { maxBase: 1 },
        isActive: true,
      },
    });
    const foreignRes = await fetch(`${baseUrl}/api/v1/hr/payroll/localization/detail/${foreign.id}`, {
      headers: authHeaders(),
    });
    expect(foreignRes.status).toBe(404);
  });
});
