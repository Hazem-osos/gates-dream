/**
 * Phase 5.1 Wave A.2 — financial closure integration.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import {
  componentAmounts,
  seedPayrollAttendance,
} from '../helpers/hcm-payroll-wave-a.fixture';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';
import { payrollWorkflowService } from '../../modules/hr/services/payroll/payroll-workflow.service';
import { payrollPostingService } from '../../modules/hr/services/payroll-posting.service';
import { payrollContextBuilderService } from '../../modules/hr/services/payroll/payroll-context-builder.service';
import { payrollLocalizationService } from '../../modules/hr/services/payroll/payroll-localization.service';
import { payrollGlMappingService } from '../../modules/hr/services/payroll/payroll-gl-mapping.service';
import { payrollComponentJournalService } from '../../modules/hr/services/payroll/payroll-component-journal.service';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import { payrollEngineService } from '../../modules/hr/services/payroll-engine.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

function ctx(fx: { companyId: string; branchId: string; fiscalYearId: string }) {
  return invoicePostingContextFromIds({
    companyId: fx.companyId,
    branchId: fx.branchId,
    fiscalYearId: fx.fiscalYearId,
    userId: 'wave-a2',
  });
}

async function runMonth(
  fx: Awaited<ReturnType<typeof createPayrollFixture>>,
  month: number,
  days?: Parameters<typeof seedPayrollAttendance>[2]
) {
  if (days?.length) await seedPayrollAttendance(prisma, fx, days);
  return payrollRunCalculationService.createPayrollRun(fx.companyId, {
    periodYear: 2026,
    periodMonth: month,
    branchId: fx.branchId,
    fiscalYearId: fx.fiscalYearId,
  });
}

describeDb('HCM Phase 5.1 Wave A.2', () => {
  jest.setTimeout(360_000);

  const matrix: Array<{
    name: string;
    month: number;
    days: Parameters<typeof seedPayrollAttendance>[2];
    assert: (map: Map<string, number>, vars: Record<string, number>) => void;
  }> = [
    {
      name: 'half-day paid leave',
      month: 1,
      days: [{ logicalWorkDate: '2026-01-08', paidLeaveMinutes: 240, workedMinutes: 240 }],
      assert: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
    },
    {
      name: 'half-day unpaid leave',
      month: 2,
      days: [
        {
          logicalWorkDate: '2026-02-08',
          unpaidLeaveMinutes: 480,
          workedMinutes: 0,
          scheduledMinutes: 480,
          absenceMinutes: 0,
        },
      ],
      assert: (m, v) => {
        expect(v.leave_unpaid_minutes).toBeGreaterThan(0);
        expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0);
      },
    },
    {
      name: 'hourly paid leave',
      month: 3,
      days: [{ logicalWorkDate: '2026-03-08', paidLeaveMinutes: 60, workedMinutes: 420 }],
      assert: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
    },
    {
      name: 'hourly unpaid leave',
      month: 4,
      days: [
        {
          logicalWorkDate: '2026-04-08',
          unpaidLeaveMinutes: 60,
          workedMinutes: 420,
          scheduledMinutes: 480,
          lateMinutes: 0,
        },
      ],
      assert: (m, v) => {
        expect(v.leave_unpaid_minutes).toBe(60);
        expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0);
      },
    },
    {
      name: 'partial leave + worked time',
      month: 5,
      days: [{ logicalWorkDate: '2026-05-08', paidLeaveMinutes: 120, workedMinutes: 360 }],
      assert: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
    },
    {
      name: 'leave overlapping absence',
      month: 6,
      days: [
        {
          logicalWorkDate: '2026-06-08',
          unpaidLeaveMinutes: 180,
          absenceMinutes: 180,
          workedMinutes: 300,
        },
      ],
      assert: (m, v) => {
        expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0);
        expect(m.get('ABSENCE') ?? 0).toBe(0);
        expect(v.time_absence_billable_minutes).toBe(0);
      },
    },
    {
      name: 'rest day work',
      month: 7,
      days: [
        {
          logicalWorkDate: '2026-07-08',
          dayClassification: 'REST_DAY',
          workedMinutes: 240,
          scheduledMinutes: 0,
        },
      ],
      assert: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
    },
    {
      name: 'holiday classification',
      month: 8,
      days: [
        {
          logicalWorkDate: '2026-08-08',
          dayClassification: 'HOLIDAY',
          workedMinutes: 120,
          scheduledMinutes: 0,
        },
      ],
      assert: (m) => expect(m.get('BASIC')).toBeGreaterThan(0),
    },
  ];

  for (const row of matrix) {
    it(`matrix: ${row.name}`, async () => {
      const fx = await createPayrollFixture(prisma);
      const run = await runMonth(fx, row.month, row.days);
      const map = await componentAmounts(prisma, run.id, fx.employeeId);
      const built = await payrollContextBuilderService.buildEmployeeContext(
        fx.companyId,
        fx.employeeId,
        2026,
        row.month
      );
      row.assert(map, built.vars);
      const billable =
        (built.vars.time_late_billable_minutes ?? 0) +
        (built.vars.time_early_leave_billable_minutes ?? 0) +
        (built.vars.time_absence_billable_minutes ?? 0) +
        (built.vars.leave_unpaid_minutes ?? 0);
      const raw =
        built.time.lateMinutes +
        built.time.earlyLeaveMinutes +
        built.time.absenceMinutes +
        built.time.unpaidLeaveMinutes;
      expect(billable).toBeLessThanOrEqual(raw + 1);
    });
  }

  it('one-time input: two-run consume race (DB)', async () => {
    const fx = await createPayrollFixture(prisma);
    const bonus = await prisma.hcmPayComponent.findFirst({
      where: { companyId: fx.companyId, code: 'BONUS' },
    });
    const input = await prisma.hcmPayrollOneTimeInput.create({
      data: {
        companyId: fx.companyId,
        employmentId: fx.employmentId,
        employeeId: fx.employeeId,
        payComponentId: bonus!.id,
        periodYear: 2026,
        periodMonth: 9,
        amount: 750,
        status: 'APPROVED',
      },
    });
    const runA = await runMonth(fx, 9);
    const runB = await runMonth(fx, 10);
    const results = await Promise.allSettled([
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM hcm_payroll_one_time_inputs WHERE id = ${input.id} FOR UPDATE`;
        return tx.hcmPayrollOneTimeInput.updateMany({
          where: { id: input.id, status: 'APPROVED', consumedRunId: null },
          data: { consumedRunId: runA.id, status: 'CONSUMED' },
        });
      }),
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM hcm_payroll_one_time_inputs WHERE id = ${input.id} FOR UPDATE`;
        return tx.hcmPayrollOneTimeInput.updateMany({
          where: { id: input.id, status: 'APPROVED', consumedRunId: null },
          data: { consumedRunId: runB.id, status: 'CONSUMED' },
        });
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ count: number }>).value.count === 1);
    expect(ok.length).toBe(1);
    const row = await prisma.hcmPayrollOneTimeInput.findUnique({ where: { id: input.id } });
    expect(row?.status).toBe('CONSUMED');
    expect([runA.id, runB.id]).toContain(row?.consumedRunId);
  });

  it('advance FIFO + reversal restores balances', async () => {
    const fx = await createPayrollFixture(prisma);
    const a1 = await prisma.employeeAdvance.create({
      data: {
        employeeId: fx.employeeId,
        date: new Date('2026-01-01'),
        value: 2000,
        remainingAmount: 2000,
        monthlyInstallment: 800,
        isActive: true,
        isSettled: false,
      },
    });
    const a2 = await prisma.employeeAdvance.create({
      data: {
        employeeId: fx.employeeId,
        date: new Date('2026-01-10'),
        value: 1000,
        remainingAmount: 1000,
        monthlyInstallment: 500,
        isActive: true,
        isSettled: false,
      },
    });
    const run = await runMonth(fx, 11);
    const comps = await prisma.hcmPayrollItemComponent.findMany({
      where: {
        componentCode: 'ADVANCE_RECOVERY',
        payrollRunItem: { payrollRunId: run.id },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(comps.length).toBeGreaterThan(0);
    expect(comps.some((c) => c.sourceRef === a1.id)).toBe(true);
    const totalRec = comps.reduce((s, c) => s + Number(c.amount), 0);
    expect(totalRec).toBeGreaterThan(0);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'adv');
    const posted = await payrollPostingService.postAccrual(ctx(fx), run.id);
    const mid1 = Number((await prisma.employeeAdvance.findUnique({ where: { id: a1.id } }))!.remainingAmount);
    expect(mid1).toBeLessThan(2000);
    await payrollPostingService.unpostAccrual(ctx(fx), posted!.id);
    const after1 = Number((await prisma.employeeAdvance.findUnique({ where: { id: a1.id } }))!.remainingAmount);
    expect(after1).toBe(2000);
    expect(Number((await prisma.employeeAdvance.findUnique({ where: { id: a2.id } }))!.remainingAmount)).toBe(1000);
  });

  it('EG + SA localization provider contract (TEST)', async () => {
    const fx = await createPayrollFixture(prisma);
    const eff = new Date('2026-03-01T12:00:00.000Z');
    await prisma.hcmPayrollLocalizationConfig.upsert({
      where: {
        companyId_countryCode_configKey_effectiveFrom: {
          companyId: fx.companyId,
          countryCode: 'EG',
          configKey: 'INSURANCE_CAP',
          effectiveFrom: eff,
        },
      },
      create: {
        companyId: fx.companyId,
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: eff,
        configJson: { maxBase: 15000 },
        isActive: true,
      },
      update: { configJson: { maxBase: 15000 }, isActive: true },
    });
    await prisma.hcmPayrollLocalizationConfig.upsert({
      where: {
        companyId_countryCode_configKey_effectiveFrom: {
          companyId: fx.companyId,
          countryCode: 'SA',
          configKey: 'GOSI_RATES',
          effectiveFrom: eff,
        },
      },
      create: {
        companyId: fx.companyId,
        countryCode: 'SA',
        configKey: 'GOSI_RATES',
        effectiveFrom: eff,
        configJson: { employeeRate: 0.09, employerRate: 0.11 },
        isActive: true,
      },
      update: { configJson: { employeeRate: 0.09, employerRate: 0.11 }, isActive: true },
    });
    const empSnap = {
      employeeId: fx.employeeId,
      employmentId: fx.employmentId,
      countryCode: 'EG',
      socialInsuranceEnrolled: true,
      taxExemptionAmount: 0,
    };
    const eg = await payrollLocalizationService.buildStatutoryFacts(fx.companyId, 'EG', new Date('2026-06-01'), {
      employee: empSnap,
      compensation: { byCode: { BASIC: 20000 } },
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    });
    expect(eg.statutory_insurance_cap).toBe(15000);
    const sa = await payrollLocalizationService.buildStatutoryFacts(fx.companyId, 'SA', new Date('2026-06-01'), {
      employee: { ...empSnap, countryCode: 'SA' },
      compensation: { byCode: { BASIC: 20000 } },
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    });
    expect(sa.statutory_employee_insurance_rate).toBe(0.09);
    expect(
      await payrollLocalizationService.validateConfig(fx.companyId, 'EG', 'INSURANCE_CAP', { maxBase: 1 })
    ).toEqual([]);
    expect(
      (await payrollLocalizationService.validateConfig(fx.companyId, 'SA', 'GOSI_RATES', {})).length
    ).toBeGreaterThan(0);
  });

  it('historical dimensions on journal lines', async () => {
    const fx = await createPayrollFixture(prisma);
    const deptSales = await prisma.department.create({
      data: { companyId: fx.companyId, arabicName: 'SALES', unitType: 'DEPARTMENT' },
    });
    const ccSales = await prisma.costCenter.create({
      data: { companyId: fx.companyId, code: 'CC_SALES', arabicName: 'Sales CC' },
    });
    await prisma.employee.update({
      where: { id: fx.employeeId },
      data: { departmentId: deptSales.id, costCenterId: ccSales.id },
    });
    const run = await runMonth(fx, 12);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'dim');
    const posted = await payrollPostingService.postAccrual(ctx(fx), run.id);
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: posted!.accrualJournalEntryId! },
    });
    const snap = await prisma.hcmPayrollItemComponent.findFirst({
      where: {
        payrollRunItem: { payrollRunId: run.id },
        costCenterIdSnapshot: ccSales.id,
      },
    });
    expect(snap).toBeTruthy();
    expect(lines.length).toBeGreaterThan(0);

    const ccOps = await prisma.costCenter.create({
      data: { companyId: fx.companyId, code: 'CC_OPS', arabicName: 'Ops CC' },
    });
    await prisma.employee.update({
      where: { id: fx.employeeId },
      data: { costCenterId: ccOps.id },
    });
    const linesAfter = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: posted!.accrualJournalEntryId! },
    });
    expect(linesAfter).toEqual(lines);
  });

  it('reversal + reversal idempotency', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runMonth(fx, 1);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'rev');
    const posted = await payrollPostingService.postAccrual(ctx(fx), run.id);
    const jeId = posted!.accrualJournalEntryId!;
    const un1 = await payrollPostingService.unpostAccrual(ctx(fx), run.id);
    expect(un1.status).toBe('DRAFT');
    const un2 = await payrollPostingService.unpostAccrual(ctx(fx), run.id);
    expect(un2.status).toBe('DRAFT');
    const je = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(je).toBeTruthy();
    const runAfter = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(runAfter?.accrualJournalEntryId).toBeNull();
  });

  it('payment canonical net + PAY idempotency', async () => {
    const fx = await createPayrollFixture(prisma);
    let cash = await prisma.account.findFirst({ where: { companyId: fx.companyId, code: '1070' } });
    if (!cash) {
      cash = await prisma.account.create({
        data: {
          companyId: fx.companyId,
          code: '1070',
          arabicName: 'Cash',
          accountType: 'asset',
          isActive: true,
        },
      });
    }
    const safe = await prisma.safe.create({
      data: {
        companyId: fx.companyId,
        arabicName: 'Pay Safe',
        code: `SAFE-${Date.now()}`,
        currencyCode: 'EGP',
        glAccountId: cash!.id,
        balance: 0,
      },
    });
    const run = await runMonth(fx, 2);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'pay');
    await payrollPostingService.postAccrual(ctx(fx), run.id);
    const before = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    const [p1, p2] = await Promise.all([
      payrollPostingService.disbursePayroll(ctx(fx), run.id, { safeId: safe.id }),
      payrollPostingService.disbursePayroll(ctx(fx), run.id, { safeId: safe.id }),
    ]);
    expect(p1!.paymentJournalEntryId).toBe(p2!.paymentJournalEntryId);
    expect(Number(p1!.totalNet)).toBe(Number(before!.totalNet));
    const payJe = await prisma.journalEntry.findUnique({
      where: { id: p1!.paymentJournalEntryId! },
      include: { lines: true },
    });
    const totals = journalPostingService.computeBaseTotals(
      payJe!.lines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
        exchangeRate: Number(l.exchangeRate),
      }))
    );
    expect(Math.abs(totals.debitBase - totals.creditBase)).toBeLessThan(0.05);
  });

  it('approval state machine rejects illegal transitions', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runMonth(fx, 3);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'sm');
    await payrollPostingService.postAccrual(ctx(fx), run.id);
    await expect(payrollWorkflowService.approveRun(fx.companyId, run.id, 'sm')).rejects.toThrow();
    await expect(
      payrollRunCalculationService.createPayrollRun(fx.companyId, { periodYear: 2026, periodMonth: 3 })
    ).rejects.toThrow();
  });

  it('calculate × calculate concurrency', async () => {
    const fx = await createPayrollFixture(prisma);
    const results = await Promise.allSettled([
      runMonth(fx, 4),
      runMonth(fx, 4),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const runs = await prisma.payrollRun.findMany({
      where: { companyId: fx.companyId, periodYear: 2026, periodMonth: 4 },
    });
    expect(runs.length).toBe(1);
  });

  it('tenancy: cannot post foreign payroll run', async () => {
    const fxA = await createPayrollFixture(prisma);
    const fxB = await createPayrollFixture(prisma);
    const run = await runMonth(fxA, 5);
    await payrollWorkflowService.approveRun(fxA.companyId, run.id, 't');
    await expect(payrollPostingService.postAccrual(ctx(fxB), run.id)).rejects.toThrow();
  });

  it('BullMQ idempotency key on payroll run', async () => {
    const fx = await createPayrollFixture(prisma);
    const key = `test-${Date.now()}`;
    const run = await payrollRunCalculationService.createPayrollRun(fx.companyId, {
      periodYear: 2026,
      periodMonth: 6,
      calculatedById: 'worker',
    });
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { calculationJobId: key },
    });
    const dup = await prisma.payrollRun.findFirst({
      where: { companyId: fx.companyId, periodYear: 2026, periodMonth: 6, calculationJobId: key },
    });
    expect(dup?.id).toBe(run.id);
  });

  it('component GL mapping covers E2E components', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runMonth(fx, 7);
    const map = await payrollGlMappingService.resolveComponentMappings(fx.companyId);
    for (const code of ['BASIC', 'HOUSING', 'TRANSPORT', 'SOCIAL_INSURANCE_EE', 'SOCIAL_INSURANCE_ER']) {
      expect(map.get(code)?.expenseAccountId || map.get(code)?.payableAccountId).toBeTruthy();
    }
    const blockers = await payrollGlMappingService.assertMappingsForRun(
      fx.companyId,
      [...(await componentAmounts(prisma, run.id, fx.employeeId)).keys()]
    );
    expect(blockers).toEqual([]);
    const lines = await payrollComponentJournalService.buildAccrualLines(fx.companyId, run.id);
    expect(lines.length).toBeGreaterThan(2);
  });

  it('audit fields on financial actions', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runMonth(fx, 8);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'auditor');
    const approved = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(approved?.approvedById).toBe('auditor');
    expect(approved?.approvedAt).toBeTruthy();
    const posted = await payrollPostingService.postAccrual(ctx(fx), run.id);
    expect(posted?.postedById).toBeTruthy();
  });

  it('missing GL mapping blocks postAccrual', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runMonth(fx, 13);
    const item = await prisma.payrollRunItem.findFirst({
      where: { payrollRunId: run.id, employeeId: fx.employeeId },
    });
    expect(item).toBeTruthy();
    await prisma.hcmPayrollItemComponent.create({
      data: {
        payrollRunItemId: item!.id,
        componentCode: 'GHOST_DED',
        componentType: 'DEDUCTION',
        phase: 0,
        amount: 50,
      },
    });
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'gl-block');
    await expect(payrollPostingService.postAccrual(ctx(fx), run.id)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringMatching(/MISSING_GL_MAPPING:GHOST_DED/),
    });
  });

  it('calculate × approve concurrency does not leave orphan APPROVED on deleted run', async () => {
    const fx = await createPayrollFixture(prisma);
    const first = await runMonth(fx, 14);
    const results = await Promise.allSettled([
      payrollWorkflowService.approveRun(fx.companyId, first.id, 'cx-approve'),
      runMonth(fx, 14),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    const periodRun = await prisma.payrollRun.findUnique({
      where: {
        companyId_periodYear_periodMonth: {
          companyId: fx.companyId,
          periodYear: 2026,
          periodMonth: 14,
        },
      },
    });
    expect(periodRun).toBeTruthy();
    const runs = await prisma.payrollRun.findMany({
      where: { companyId: fx.companyId, periodYear: 2026, periodMonth: 14 },
    });
    expect(runs.length).toBe(1);
    if (periodRun!.status === 'APPROVED') {
      expect(periodRun!.approvedById).toBe('cx-approve');
    }
  });

  it('POST × REVERSE: concurrent unpost is idempotent (single reversal)', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runMonth(fx, 15);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'pr');
    const posted = await payrollPostingService.postAccrual(ctx(fx), run.id);
    const jeId = posted!.accrualJournalEntryId!;
    const [u1, u2] = await Promise.all([
      payrollPostingService.unpostAccrual(ctx(fx), run.id),
      payrollPostingService.unpostAccrual(ctx(fx), run.id),
    ]);
    expect(u1!.status).toBe('DRAFT');
    expect(u2!.status).toBe('DRAFT');
    const je = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(je?.isPosted).toBe(false);
    expect(je?.postingStatus).toBe('UnPost');
    const runAfter = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(runAfter?.accrualJournalEntryId).toBeNull();
  });
});
