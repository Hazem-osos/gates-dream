/**
 * Phase 5.1 Wave B.7 — rule designer HTTP lifecycle.
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
    req.user = { sub: 'b7-rule-admin' };
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
    { resource: 'payroll', action: 'rules_manage', allow: true, module: 'hr', branchId: null },
  ];
}

describeDb('HCM Phase 5.1 Wave B.7 rule designer HTTP', () => {
  jest.setTimeout(120_000);
  let baseUrl: string;
  let server: ReturnType<typeof express.application.listen>;
  let fx: Awaited<ReturnType<typeof createPayrollFixture>>;
  let payComponentId: string;

  beforeAll(async () => {
    fx = await createPayrollFixture(prisma);
    tenantCompanyId = fx.companyId;
    const comp = await prisma.hcmPayComponent.findFirst({ where: { companyId: fx.companyId } });
    payComponentId = comp!.id;

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

  it('creates rule with full field round-trip via detail read', async () => {
    const code = `B7R${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/v1/hr/payroll/rules`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        code,
        name: 'B7 Rule',
        payComponentId,
        phase: 20,
        priority: 50,
        effectiveFrom: '2026-04-01',
        effectiveTo: '2026-12-31',
        formulaExpr: 'comp_basic / period_days',
        conditionExpr: 'period_days > 0',
        roundingMode: 'HALF_UP_4',
        minAmount: 10,
        maxAmount: 99999,
        localizationKey: 'TEST_SCOPE',
        dependsOnCodes: [],
        isActive: true,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const detailRes = await fetch(`${baseUrl}/api/v1/hr/payroll/rules/detail/${created.data.id}`, {
      headers: authHeaders(),
    });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.data.code).toBe(code);
    expect(detail.data.priority).toBe(50);
    expect(detail.data.roundingMode).toBe('HALF_UP_4');
    expect(Number(detail.data.minAmount)).toBe(10);
    expect(detail.data.localizationKey).toBe('TEST_SCOPE');
    expect(detail.data.conditionExpr).toContain('period_days');
    expect(detail.data.frozen).toBe(false);
  });

  it('rejects overlapping effective periods for same code', async () => {
    const code = `B7OVR${Date.now()}`;
    const payload = {
      code,
      name: 'Overlap A',
      payComponentId,
      effectiveFrom: '2026-05-01',
      effectiveTo: '2026-06-30',
      formulaExpr: 'comp_basic',
    };
    const first = await fetch(`${baseUrl}/api/v1/hr/payroll/rules`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);
    const second = await fetch(`${baseUrl}/api/v1/hr/payroll/rules`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        ...payload,
        name: 'Overlap B',
        effectiveFrom: '2026-05-15',
        effectiveTo: null,
      }),
    });
    expect(second.status).toBe(422);
  });

  it('rejects unknown rule dependency on validate', async () => {
    const valRes = await fetch(`${baseUrl}/api/v1/hr/payroll/rules/validate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        code: `B7DEP${Date.now()}`,
        payComponentId,
        phase: 10,
        priority: 100,
        formulaExpr: 'comp_basic',
        dependsOnCodes: ['RULE_DOES_NOT_EXIST'],
      }),
    });
    expect(valRes.status).toBe(200);
    const val = await valRes.json();
    expect(val.data.valid).toBe(false);
    expect(val.data.errors.join(' ')).toMatch(/missing rule/i);
  });

  it('validates and simulates without persisting payroll', async () => {
    const beforeRuns = await prisma.payrollRun.count({ where: { companyId: fx.companyId } });
    const valRes = await fetch(`${baseUrl}/api/v1/hr/payroll/rules/validate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        code: 'B7VAL',
        payComponentId,
        formulaExpr: 'comp_basic',
        phase: 10,
        priority: 100,
      }),
    });
    expect(valRes.status).toBe(200);
    const val = await valRes.json();
    expect(val.data.valid).toBe(true);

    const simRes = await fetch(`${baseUrl}/api/v1/hr/payroll/rules/simulate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        employeeId: fx.employeeId,
        periodYear: 2026,
        periodMonth: 1,
        formulaExpr: 'comp_basic / period_days',
      }),
    });
    expect(simRes.status).toBe(200);
    const sim = await simRes.json();
    expect(sim.data.amount).toBeGreaterThan(0);
    const afterRuns = await prisma.payrollRun.count({ where: { companyId: fx.companyId } });
    expect(afterRuns).toBe(beforeRuns);
  });

  it('lists versions and blocks formula patch when frozen', async () => {
    const run = await runPayrollMonth(prisma, fx, 1);
    const item = await prisma.payrollRunItem.findFirst({ where: { payrollRunId: run.id } });
    const line = await prisma.hcmPayrollItemComponent.findFirst({
      where: { payrollRunItemId: item!.id },
    });
    const comp = await prisma.hcmPayComponent.findFirst({
      where: { companyId: fx.companyId, code: line!.componentCode },
    });
    const code = `B7FRZ${Date.now()}`;
    const rule = await prisma.hcmPayrollRule.create({
      data: {
        companyId: fx.companyId,
        payComponentId: comp!.id,
        code,
        name: 'Frozen',
        phase: 10,
        priority: 100,
        effectiveFrom: new Date('2026-01-01'),
        formulaExpr: 'comp_basic',
        roundingMode: 'HALF_UP_2',
        isActive: true,
      },
    });
    await prisma.hcmPayrollItemComponent.update({
      where: { id: line!.id },
      data: { ruleId: rule.id, ruleCode: rule.code },
    });

    const versionsRes = await fetch(
      `${baseUrl}/api/v1/hr/payroll/rules/${encodeURIComponent(code)}/versions`,
      { headers: authHeaders() }
    );
    expect(versionsRes.status).toBe(200);
    const versions = await versionsRes.json();
    expect(versions.data.length).toBeGreaterThanOrEqual(1);

    const patchRes = await fetch(`${baseUrl}/api/v1/hr/payroll/rules/${rule.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ formulaExpr: 'comp_basic * 2' }),
    });
    expect(patchRes.status).toBe(422);
  });

  it('enforces permissions and tenant isolation', async () => {
    permissions = [{ resource: 'payroll', action: 'view', allow: true, module: 'hr', branchId: null }];
    const forbidden = await fetch(`${baseUrl}/api/v1/hr/payroll/rules`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        code: 'X',
        payComponentId,
        effectiveFrom: '2026-01-01',
        formulaExpr: 'comp_basic',
      }),
    });
    expect(forbidden.status).toBe(403);

    permissions = adminPerms();
    const otherFx = await createPayrollFixture(prisma);
    const otherRule = await prisma.hcmPayrollRule.create({
      data: {
        companyId: otherFx.companyId,
        payComponentId: (
          await prisma.hcmPayComponent.findFirst({ where: { companyId: otherFx.companyId } })
        )!.id,
        code: `OTH${Date.now()}`,
        name: 'Other',
        phase: 10,
        priority: 100,
        effectiveFrom: new Date('2026-01-01'),
        formulaExpr: 'comp_basic',
        roundingMode: 'HALF_UP_2',
        isActive: true,
      },
    });
    const foreign = await fetch(`${baseUrl}/api/v1/hr/payroll/rules/detail/${otherRule.id}`, {
      headers: authHeaders(),
    });
    expect(foreign.status).toBe(404);
  });
});
