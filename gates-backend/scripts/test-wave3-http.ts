/**
 * Wave 3 — vertical engines over HTTP, the way the UI calls them.
 *
 * The other wave3 scripts drive services directly, so they cannot catch wiring defects:
 * a missing auth gate, an unmounted tenant/fiscal middleware (posting endpoints then reject
 * every request for a missing X-Fiscal-Year-Id), or a license gate that never runs.
 * This boots the real Express app with API_AUTH_MODE=enforce and creates + posts one
 * critical document per vertical through the API.
 *
 * Depends on the fixtures seeded by the wave1/wave3 service tests.
 * Run: npm run test:wave3-http
 */
import 'dotenv/config';
import { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import {
  invalidateTenantCache,
  tenantCacheKeys,
} from '../src/shared/cache/tenant-metadata-cache';

// Must be set before app.ts is imported: the auth mode is resolved once at module load.
process.env.API_AUTH_MODE = 'enforce';
process.env.KEYCLOAK_ENABLED = 'false';
process.env.JWT_DEV_SECRET = process.env.JWT_DEV_SECRET ?? 'wave3-http-test-secret-key';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const RAW1_ID = '00000000-0000-0000-0000-0000000000a1';
const RAW2_ID = '00000000-0000-0000-0000-0000000000a2';
const FG_ID = '00000000-0000-0000-0000-0000000000a3';
const CONTRACTOR_ID = '00000000-0000-0000-0000-0000000000b2';
const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000095';

const stamp = Date.now();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

interface ApiResult<T = any> {
  status: number;
  body: T;
}

class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    options: { fiscalYear?: boolean; branch?: boolean; token?: string | null } = {}
  ): Promise<ApiResult<T>> {
    const { fiscalYear = true, branch = true, token = this.token } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Company-Id': COMPANY_ID,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (branch) headers['X-Branch-Id'] = BRANCH_ID;
    if (fiscalYear) headers['X-Fiscal-Year-Id'] = FISCAL_YEAR_ID;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      /* non-JSON error page */
    }
    return { status: response.status, body: parsed as T };
  }

  get<T = any>(path: string, options?: Parameters<ApiClient['request']>[3]) {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T = any>(path: string, body?: unknown, options?: Parameters<ApiClient['request']>[3]) {
    return this.request<T>('POST', path, body, options);
  }
}

/** Asserts a 2xx and returns `data`, surfacing the API message when it fails. */
function ok<T = any>(result: ApiResult, what: string): T {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `ASSERT: ${what} expected 2xx, got ${result.status} — ${JSON.stringify(result.body).slice(0, 300)}`
    );
  }
  return (result.body as { data: T }).data;
}

async function assertJournalPosted(journalEntryId: string, what: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { lines: true },
  });
  assert(!!entry, `${what}: journal entry exists`);
  assert(entry!.isPosted, `${what}: journal posted`);
  const debit = entry!.lines.reduce((s, l) => s + Number(l.debitBase), 0);
  const credit = entry!.lines.reduce((s, l) => s + Number(l.creditBase), 0);
  assert(Math.abs(debit - credit) < 0.02, `${what}: journal balanced`);
}

async function resolveTestUser(): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { companyId: COMPANY_ID },
    select: { id: true, email: true, username: true },
  });
  assert(!!user, 'A user exists for the fixture company (run npm run seed)');
  return user!.id;
}

function signToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      email: 'wave3-http@example.com',
      username: 'wave3-http',
      company_id: COMPANY_ID,
      tenant_id: COMPANY_ID,
      branch_id: BRANCH_ID,
      realm_access: { roles: ['admin'] },
      role: 'admin',
    },
    process.env.JWT_DEV_SECRET as string,
    { algorithm: 'HS256', expiresIn: '10m' }
  );
}

/**
 * Other suites activate a restricted subscription for the fixture company; with the license gate
 * now mounted, that would 403 every vertical here. Start from unrestricted.
 */
async function clearLicenseRestrictions() {
  await prisma.tenantSubscription.deleteMany({ where: { companyId: COMPANY_ID } });
  // `licenseSubscriptionService.getForCompany` caches the subscription row; production code
  // only ever mutates it through `activate()`, which invalidates this same key, but the direct
  // Prisma writes here (and in the M21 section below) need to do so manually or the gate keeps
  // enforcing whatever was cached before this test run.
  await invalidateTenantCache(tenantCacheKeys.subscription(COMPANY_ID));
}

async function testAuthAndTenantGates(api: ApiClient) {
  console.log('  • auth + tenant gates');

  const anonymous = await api.get('/api/v1/manufacturing/boms', { token: null });
  assert(anonymous.status === 401, `Unauthenticated request rejected (got ${anonymous.status})`);

  const listed = await api.get('/api/v1/manufacturing/boms');
  assert(listed.status === 200, `Authenticated request accepted (got ${listed.status})`);

  const mismatched = await api.request('GET', '/api/v1/manufacturing/boms', undefined, {});
  assert(mismatched.status === 200, 'Matching X-Company-Id accepted');
}

async function testManufacturing(api: ApiClient) {
  console.log('  • M8 manufacturing: BOM → order → issue materials');

  const bom = await api
    .post('/api/v1/manufacturing/boms', {
      name: `HTTP Recipe ${stamp}`,
      finishedItemId: FG_ID,
      baseQuantity: 1,
      standardLaborCost: 8,
      standardOverheadCost: 2,
      lines: [
        { rawItemId: RAW1_ID, quantity: 2 },
        { rawItemId: RAW2_ID, quantity: 2 },
      ],
    })
    .then((r) => ok<{ id: string }>(r, 'POST /manufacturing/boms'));

  const order = await api
    .post('/api/v1/manufacturing/orders', {
      orderNumber: `MO-HTTP-${stamp}`,
      bomId: bom.id,
      plannedQuantity: 1,
      warehouseIdRaw: WAREHOUSE_ID,
      warehouseIdFinished: WAREHOUSE_ID,
    })
    .then((r) => ok<{ id: string; status: string }>(r, 'POST /manufacturing/orders'));
  assert(order.status === 'DRAFT', 'Order created as DRAFT');

  ok(
    await api.post(`/api/v1/manufacturing/orders/${order.id}/release`),
    'POST /manufacturing/orders/:id/release'
  );

  // The posting guard must reject a call that omits the fiscal-year header.
  const withoutFiscalYear = await api.post(
    `/api/v1/manufacturing/orders/${order.id}/issue-materials`,
    undefined,
    { fiscalYear: false }
  );
  assert(
    withoutFiscalYear.status === 400,
    `Issue without X-Fiscal-Year-Id rejected (got ${withoutFiscalYear.status})`
  );

  const issued = ok<{ status: string; materialsIssueJournalEntryId: string }>(
    await api.post(`/api/v1/manufacturing/orders/${order.id}/issue-materials`),
    'POST /manufacturing/orders/:id/issue-materials'
  );
  assert(issued.status === 'IN_PROGRESS', 'Order IN_PROGRESS after issue');
  await assertJournalPosted(issued.materialsIssueJournalEntryId, 'Manufacturing material issue');
}

async function testContracting(api: ApiClient) {
  console.log('  • M11/M13 contracting: project → client extract → post');

  const project = ok<{ id: string }>(
    await api.post('/api/v1/contracting/projects', {
      projectCode: `PRJ-HTTP-${stamp}`,
      projectName: 'HTTP contracting project',
      contractValue: 500_000,
      customerId: CUSTOMER_ID,
      advanceDeductionPercent: 10,
      retentionPercent: 5,
    }),
    'POST /contracting/projects'
  );

  const extract = ok<{ id: string; status: string }>(
    await api.post('/api/v1/contracting/client-extracts', {
      projectId: project.id,
      extractNumber: `EXT-HTTP-${stamp}`,
      grossAmount: 100_000,
    }),
    'POST /contracting/client-extracts'
  );
  assert(extract.status === 'DRAFT', 'Extract created as DRAFT');

  const posted = ok<{ status: string; journalEntryId: string }>(
    await api.post(`/api/v1/contracting/client-extracts/${extract.id}/post`),
    'POST /contracting/client-extracts/:id/post'
  );
  assert(posted.status === 'POSTED', 'Extract POSTED');
  await assertJournalPosted(posted.journalEntryId, 'Client extract');
}

async function testRealEstate(api: ApiClient) {
  console.log('  • M12 real estate: unit → contract → post');

  const project = ok<{ id: string }>(
    await api.post('/api/v1/real-estate/units/projects', {
      projectCode: `REP-HTTP-${stamp}`,
      projectName: 'HTTP tower',
    }),
    'POST /real-estate/units/projects'
  );

  const building = ok<{ id: string }>(
    await api.post('/api/v1/real-estate/buildings', {
      projectId: project.id,
      buildingCode: `BLD-HTTP-${stamp}`,
      name: 'Block A',
      totalFloors: 5,
    }),
    'POST /real-estate/buildings'
  );

  const unit = ok<{ id: string }>(
    await api.post('/api/v1/real-estate/units', {
      buildingId: building.id,
      unitCode: `UNIT-HTTP-${stamp}`,
      floor: 2,
      grossArea: 120,
      netArea: 100,
      totalPrice: 1_200_000,
    }),
    'POST /real-estate/units'
  );

  const contract = ok<{ id: string; installments: unknown[] }>(
    await api.post('/api/v1/real-estate/contracts', {
      unitId: unit.id,
      customerId: CUSTOMER_ID,
      contractNumber: `REC-HTTP-${stamp}`,
      contractDate: new Date().toISOString(),
      totalContractAmount: 1_200_000,
      downPayment: 200_000,
      frequency: 'MONTHLY',
      installmentCount: 10,
    }),
    'POST /real-estate/contracts'
  );
  // 10 periodic installments + the down-payment row the schedule emits as number 0.
  assert(contract.installments.length === 11, 'Installment schedule generated');

  const posted = ok<{ status: string; contractJournalEntryId: string }>(
    await api.post(`/api/v1/real-estate/contracts/${contract.id}/post-contract`),
    'POST /real-estate/contracts/:id/post-contract'
  );
  assert(posted.status !== 'DRAFT', 'Contract left DRAFT after posting');
  await assertJournalPosted(posted.contractJournalEntryId, 'Real estate contract');
}

async function testSchools(api: ApiClient) {
  console.log('  • M10 schools: grade → student → contract → accrual');

  const academicYear = ok<{ id: string }>(
    await api.post('/api/v1/schools/grades/academic-years', {
      yearCode: `AY-HTTP-${stamp}`,
      name: 'HTTP academic year',
      startDate: new Date().toISOString(),
      terms: [{ termCode: 'T1', termName: 'Term 1', sortOrder: 1 }],
    }),
    'POST /schools/grades/academic-years'
  );

  const grade = ok<{ id: string }>(
    await api.post('/api/v1/schools/grades', {
      stageName: 'Primary',
      gradeName: `Grade HTTP ${stamp}`,
      gradeCode: `G-HTTP-${stamp}`,
      defaultTuitionFee: 30_000,
    }),
    'POST /schools/grades'
  );

  const student = ok<{ id: string }>(
    await api.post('/api/v1/schools/students', {
      studentCode: `STU-HTTP-${stamp}`,
      fullName: 'HTTP Student',
      guardianCustomerId: CUSTOMER_ID,
      gradeId: grade.id,
      academicYearId: academicYear.id,
    }),
    'POST /schools/students'
  );

  const contract = ok<{ id: string; installments: unknown[] }>(
    await api.post('/api/v1/schools/contracts', {
      studentId: student.id,
      contractNumber: `SC-HTTP-${stamp}`,
      tuitionFee: 30_000,
      booksFee: 2_000,
    }),
    'POST /schools/contracts'
  );
  assert(contract.installments.length > 0, 'Tuition installments generated');

  const posted = ok<{ accrualJournalEntryId: string }>(
    await api.post(`/api/v1/schools/contracts/${contract.id}/post-accrual`),
    'POST /schools/contracts/:id/post-accrual'
  );
  await assertJournalPosted(posted.accrualJournalEntryId, 'Tuition accrual');
}

async function testPayroll(api: ApiClient) {
  console.log('  • M9 payroll: run → post accrual');

  // The service-level suite owns the current month; use a distinct period here.
  const periodYear = new Date().getUTCFullYear();
  const periodMonth = 1;
  const stale = await prisma.payrollRun.findMany({
    where: { companyId: COMPANY_ID, periodYear, periodMonth },
    select: { id: true, accrualJournalEntryId: true, paymentJournalEntryId: true },
  });
  if (stale.length > 0) {
    const journalIds = stale
      .flatMap((r) => [r.accrualJournalEntryId, r.paymentJournalEntryId])
      .filter((id): id is string => !!id);
    await prisma.payrollRunItem.deleteMany({
      where: { payrollRunId: { in: stale.map((r) => r.id) } },
    });
    await prisma.payrollRun.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
    if (journalIds.length > 0) {
      await prisma.journalEntryLine.deleteMany({
        where: { journalEntryId: { in: journalIds } },
      });
      await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    }
  }

  const run = ok<{ id: string; status: string; items: unknown[] }>(
    await api.post('/api/v1/hr/payroll-runs', {
      periodMonth,
      periodYear,
      employeeInputs: { [EMPLOYEE_ID]: { overtime: 250 } },
    }),
    'POST /hr/payroll-runs'
  );
  assert(run.status === 'DRAFT', 'Payroll run created as DRAFT');
  assert(run.items.length > 0, 'Payroll run has employee lines');

  const posted = ok<{ status: string; accrualJournalEntryId: string }>(
    await api.post(`/api/v1/hr/payroll-runs/${run.id}/post-accrual`),
    'POST /hr/payroll-runs/:id/post-accrual'
  );
  assert(posted.status === 'POSTED', 'Payroll run POSTED');
  await assertJournalPosted(posted.accrualJournalEntryId, 'Payroll accrual');
}

async function testLicenseGate(api: ApiClient) {
  console.log('  • M21 license gate on a vertical prefix');

  const existing = await prisma.tenantSubscription.findUnique({
    where: { companyId: COMPANY_ID },
    select: { id: true, allowedModules: true },
  });

  // Grant everything except MANUFACTURING, then prove that prefix alone is closed.
  const restricted = [
    'ACCOUNTING',
    'INVENTORY',
    'REAL_ESTATE',
    'SCHOOLS',
    'CONTRACTING',
    'PAYROLL',
  ];
  if (existing) {
    await prisma.tenantSubscription.update({
      where: { id: existing.id },
      data: { allowedModules: restricted },
    });
  } else {
    await prisma.tenantSubscription.create({
      data: {
        companyId: COMPANY_ID,
        planType: 'LIFETIME',
        status: 'ACTIVE',
        startDate: new Date(),
        allowedModules: restricted,
      },
    });
  }
  await invalidateTenantCache(tenantCacheKeys.subscription(COMPANY_ID));

  try {
    const blocked = await api.get('/api/v1/manufacturing/boms');
    assert(
      blocked.status === 403,
      `Unlicensed vertical rejected (got ${blocked.status} — ${JSON.stringify(blocked.body).slice(0, 200)})`
    );
    const allowed = await api.get('/api/v1/contracting/projects/does-not-exist');
    assert(allowed.status !== 403, 'Licensed vertical not blocked by the gate');
  } finally {
    if (existing) {
      await prisma.tenantSubscription.update({
        where: { id: existing.id },
        data: { allowedModules: existing.allowedModules as string[] },
      });
    } else {
      // Leave the fixture company unrestricted so later suites are unaffected.
      await prisma.tenantSubscription.deleteMany({ where: { companyId: COMPANY_ID } });
    }
    await invalidateTenantCache(tenantCacheKeys.subscription(COMPANY_ID));
  }
}

async function main() {
  console.log('Wave3 vertical HTTP test — start');

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fiscalYear, 'Run the wave1/wave3 suites first for shared fixtures');
  const contractor = await prisma.contractor.findUnique({ where: { id: CONTRACTOR_ID } });
  assert(!!contractor, 'Run test:wave3-contracting first (contractor + settings fixtures)');
  const employee = await prisma.employee.findUnique({ where: { id: EMPLOYEE_ID } });
  assert(!!employee, 'Run test:wave3-payroll first (employee + HR settings fixtures)');

  const userId = await resolveTestUser();

  const { default: app } = await import('../src/app.js');
  const { initializeAuth } = await import('../src/shared/auth/config.js');
  initializeAuth();

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const api = new ApiClient(`http://127.0.0.1:${port}`, signToken(userId));

  try {
    await clearLicenseRestrictions();
    await testAuthAndTenantGates(api);
    await testManufacturing(api);
    await testContracting(api);
    await testRealEstate(api);
    await testSchools(api);
    await testPayroll(api);
    await testLicenseGate(api);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('Wave3 vertical HTTP test — PASSED');
}

main()
  .catch((e) => {
    console.error('Wave3 vertical HTTP test — FAILED');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Importing the app starts schedulers/queues that keep the event loop alive.
    process.exit(process.exitCode ?? 0);
  });
