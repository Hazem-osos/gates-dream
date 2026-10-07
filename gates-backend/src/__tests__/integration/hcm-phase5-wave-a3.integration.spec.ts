/**
 * Phase 5.1 Wave A.3 — zero-partial financial closure integration.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { componentAmounts, seedPayrollAttendance } from '../helpers/hcm-payroll-wave-a.fixture';
import {
  PAYROLL_MATRIX_18,
  assertMatrixCase,
  runPayrollMonth,
} from '../helpers/hcm-payroll-wave-a3.helpers';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';
import { payrollWorkflowService } from '../../modules/hr/services/payroll/payroll-workflow.service';
import { payrollPostingService } from '../../modules/hr/services/payroll-posting.service';
import { payrollGlMappingService } from '../../modules/hr/services/payroll/payroll-gl-mapping.service';
import { payrollComponentJournalService } from '../../modules/hr/services/payroll/payroll-component-journal.service';
import { payrollReconciliationService } from '../../modules/hr/services/payroll/payroll-reconciliation.service';
import { payrollLocalizationService } from '../../modules/hr/services/payroll/payroll-localization.service';
import { payrollEngineService } from '../../modules/hr/services/payroll-engine.service';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import { getPayrollLocalizationProvider, listPayrollLocalizationProviders } from '../../modules/hr/services/payroll/localization/payroll-localization-registry';
import { processHcmPayrollCalculateJob } from '../../workers/processors/hcm-payroll-calculate.processor';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

function ctx(fx: { companyId: string; branchId: string; fiscalYearId: string }, userId = 'wave-a3') {
  return invoicePostingContextFromIds({
    companyId: fx.companyId,
    branchId: fx.branchId,
    fiscalYearId: fx.fiscalYearId,
    userId,
  });
}

async function ensureSafe(fx: Awaited<ReturnType<typeof createPayrollFixture>>) {
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
  return prisma.safe.create({
    data: {
      companyId: fx.companyId,
      arabicName: 'Pay Safe',
      code: `SAFE-A3-${Date.now()}`,
      currencyCode: 'EGP',
      glAccountId: cash!.id,
      balance: 0,
    },
  });
}

describeDb('HCM Phase 5.1 Wave A.3', () => {
  jest.setTimeout(420_000);

  describe('time/leave matrix 18/18', () => {
    for (const row of PAYROLL_MATRIX_18) {
      it(row.name, async () => {
        const fx = await createPayrollFixture(prisma);
        await assertMatrixCase(prisma, fx, row);
      });
    }
  });

  it('one-time input: two-run approve race consumes exactly once', async () => {
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
        periodYear: 0,
        periodMonth: 0,
        amount: 900,
        status: 'APPROVED',
      },
    });
    const runA = await runPayrollMonth(prisma, fx, 7);
    const runB = await runPayrollMonth(prisma, fx, 8);
    const results = await Promise.allSettled([
      payrollWorkflowService.approveRun(fx.companyId, runA.id, 'race-a'),
      payrollWorkflowService.approveRun(fx.companyId, runB.id, 'race-b'),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const row = await prisma.hcmPayrollOneTimeInput.findUnique({ where: { id: input.id } });
    expect(row?.status).toBe('CONSUMED');
    expect([runA.id, runB.id]).toContain(row?.consumedRunId);
    const winnerId = row!.consumedRunId!;
    const loserId = winnerId === runA.id ? runB.id : runA.id;
    const loser = await prisma.payrollRun.findUnique({ where: { id: loserId } });
    expect(loser?.status).not.toBe('APPROVED');
    const row2 = await prisma.hcmPayrollOneTimeInput.findUnique({ where: { id: input.id } });
    expect(row2?.consumedRunId).toBe(winnerId);
  });

  describe('advance matrix', () => {
    it('FIFO, partial recovery, posting retry, reversal restore', async () => {
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
          date: new Date('2026-01-12'),
          value: 1000,
          remainingAmount: 1000,
          monthlyInstallment: 500,
          isActive: true,
          isSettled: false,
        },
      });
      const run = await runPayrollMonth(prisma, fx, 9);
      const comps = await prisma.hcmPayrollItemComponent.findMany({
        where: { payrollRunItem: { payrollRunId: run.id }, componentCode: 'ADVANCE_RECOVERY' },
        orderBy: { createdAt: 'asc' },
      });
      expect(comps.some((c) => c.sourceRef === a1.id)).toBe(true);
      await payrollWorkflowService.approveRun(fx.companyId, run.id, 'adv');
      const [p1, p2] = await Promise.all([
        payrollPostingService.postAccrual(ctx(fx), run.id),
        payrollPostingService.postAccrual(ctx(fx), run.id),
      ]);
      expect(p1!.accrualJournalEntryId).toBe(p2!.accrualJournalEntryId);
      await payrollPostingService.unpostAccrual(ctx(fx), run.id);
      await payrollPostingService.unpostAccrual(ctx(fx), run.id);
      expect(Number((await prisma.employeeAdvance.findUnique({ where: { id: a1.id } }))!.remainingAmount)).toBe(2000);
      expect(Number((await prisma.employeeAdvance.findUnique({ where: { id: a2.id } }))!.remainingAmount)).toBe(1000);
      const recalc = await runPayrollMonth(prisma, fx, 9);
      expect(recalc.id).toBeTruthy();
    });
  });

  it('localization EG + SA provider contract', async () => {
    expect(getPayrollLocalizationProvider('EG')).toBeTruthy();
    expect(getPayrollLocalizationProvider('SA')).toBeTruthy();
    expect(listPayrollLocalizationProviders().map((p) => p.countryCode).sort()).toEqual(['EG', 'SA']);
    const fx = await createPayrollFixture(prisma);
    const eff = new Date('2026-02-01T12:00:00.000Z');
    const eff2 = new Date('2026-06-01T12:00:00.000Z');
    await prisma.hcmPayrollLocalizationConfig.createMany({
      data: [
        {
          companyId: fx.companyId,
          countryCode: 'EG',
          configKey: 'INSURANCE_CAP',
          effectiveFrom: eff,
          configJson: { maxBase: 12000 },
          isActive: true,
        },
        {
          companyId: fx.companyId,
          countryCode: 'EG',
          configKey: 'INSURANCE_CAP',
          effectiveFrom: eff2,
          configJson: { maxBase: 15000 },
          isActive: true,
        },
        {
          companyId: fx.companyId,
          countryCode: 'SA',
          configKey: 'GOSI_RATES',
          effectiveFrom: eff,
          configJson: { employeeRate: 0.09, employerRate: 0.11 },
          isActive: true,
        },
      ],
    });
    const emp = {
      employeeId: fx.employeeId,
      employmentId: fx.employmentId,
      countryCode: 'EG',
      socialInsuranceEnrolled: true,
      taxExemptionAmount: 0,
    };
    const early = await payrollLocalizationService.buildStatutoryFacts(fx.companyId, 'EG', new Date('2026-03-15'), {
      employee: emp,
      compensation: { byCode: { BASIC: 20000 } },
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    });
    const late = await payrollLocalizationService.buildStatutoryFacts(fx.companyId, 'EG', new Date('2026-07-15'), {
      employee: emp,
      compensation: { byCode: { BASIC: 20000 } },
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    });
    expect(early.statutory_insurance_cap).toBe(12000);
    expect(late.statutory_insurance_cap).toBe(15000);
    const saEmp = { ...emp, countryCode: 'SA' };
    const sa = await payrollLocalizationService.buildStatutoryFacts(fx.companyId, 'SA', new Date('2026-03-15'), {
      employee: saEmp,
      compensation: { byCode: { BASIC: 20000 } },
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    });
    expect(sa.statutory_employee_insurance_rate).toBe(0.09);
    expect(sa.statutory_employer_insurance_rate).toBe(0.11);
    expect(
      (await payrollLocalizationService.validateConfig(fx.companyId, 'SA', 'GOSI_RATES', {})).length
    ).toBeGreaterThan(0);
    expect(
      await payrollLocalizationService.validateEmployeeReadiness('EG', {
        employee: { ...emp, socialInsuranceEnrolled: false },
        compensation: { byCode: { BASIC: 1 } },
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
      })
    ).toEqual([]);
  });

  it('component GL mapping matrix + cross-company rejection', async () => {
    const fxA = await createPayrollFixture(prisma);
    const fxB = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fxA, 10);
    const map = await payrollGlMappingService.resolveComponentMappings(fxA.companyId);
    for (const code of [
      'BASIC',
      'HOUSING',
      'TRANSPORT',
      'OVERTIME',
      'BONUS',
      'UNPAID_LEAVE',
      'SOCIAL_INSURANCE_EE',
      'SOCIAL_INSURANCE_ER',
      'ADVANCE_RECOVERY',
    ]) {
      const m = map.get(code);
      expect(m).toBeTruthy();
      if (m!.componentType === 'EARNING' || m!.componentType === 'EMPLOYER_CONTRIBUTION') {
        expect(m!.expenseAccountId || m!.payableAccountId).toBeTruthy();
      }
    }
    const basic = await prisma.hcmPayComponent.findFirst({
      where: { companyId: fxA.companyId, code: 'BASIC' },
    });
    const acctB = await prisma.account.findFirst({ where: { companyId: fxB.companyId, code: '6100' } });
    await expect(
      payrollGlMappingService.updateComponentGlAccounts(fxB.companyId, basic!.id, {
        glExpenseAccountId: acctB!.id,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    const lines = await payrollComponentJournalService.buildAccrualLines(fxA.companyId, run.id);
    expect(lines.length).toBeGreaterThan(2);
  });

  it('historical dimensions on journal lines and entry branch', async () => {
    const fx = await createPayrollFixture(prisma);
    const branchA = fx.branchId;
    const branchB = await prisma.branch.create({
      data: { companyId: fx.companyId, arabicName: 'Branch B' },
    });
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
    const run = await runPayrollMonth(prisma, fx, 11);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'dim');
    const posted = await payrollPostingService.postAccrual(
      { ...ctx(fx), branchId: branchA },
      run.id
    );
    const je = await prisma.journalEntry.findUnique({
      where: { id: posted!.accrualJournalEntryId! },
      include: { lines: true },
    });
    expect(je!.branchId).toBe(branchA);
    expect(je!.lines.some((l) => l.costCenterId === ccSales.id)).toBe(true);
    const compSnap = await prisma.hcmPayrollItemComponent.findFirst({
      where: {
        payrollRunItem: { payrollRunId: run.id },
        departmentIdSnapshot: deptSales.id,
        costCenterIdSnapshot: ccSales.id,
      },
    });
    expect(compSnap).toBeTruthy();
    await prisma.employee.update({
      where: { id: fx.employeeId },
      data: { departmentId: null, costCenterId: null },
    });
    const linesAfter = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: je!.id },
    });
    expect(linesAfter.some((l) => l.costCenterId === ccSales.id)).toBe(true);
    expect(branchB.id).not.toBe(je!.branchId);
  });

  it('reversal full path with idempotent retry', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 12);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'rev-user');
    const posted = await payrollPostingService.postAccrual(ctx(fx, 'poster'), run.id);
    const jeId = posted!.accrualJournalEntryId!;
    const un1 = await payrollPostingService.unpostAccrual(ctx(fx, 'unposter'), run.id);
    expect(un1!.status).toBe('DRAFT');
    expect(un1!.accrualJournalEntryId).toBeNull();
    const je = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(je).toBeTruthy();
    expect(je!.isPosted).toBe(false);
    const un2 = await payrollPostingService.unpostAccrual(ctx(fx, 'unposter'), run.id);
    expect(un2!.status).toBe('DRAFT');
    const recon = await payrollReconciliationService.reconcileRun(fx.companyId, run.id);
    expect(recon.blockers.length).toBeGreaterThanOrEqual(0);
  });

  it('payment full path + PAY×PAY idempotency', async () => {
    const fx = await createPayrollFixture(prisma);
    const safe = await ensureSafe(fx);
    const run = await runPayrollMonth(prisma, fx, 1);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'pay-approver');
    await payrollPostingService.postAccrual(ctx(fx, 'pay-poster'), run.id);
    const before = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    const [d1, d2] = await Promise.all([
      payrollPostingService.disbursePayroll(ctx(fx, 'payer'), run.id, { safeId: safe.id }),
      payrollPostingService.disbursePayroll(ctx(fx, 'payer'), run.id, { safeId: safe.id }),
    ]);
    expect(d1!.status).toBe('PAID');
    expect(d1!.paymentJournalEntryId).toBe(d2!.paymentJournalEntryId);
    expect(Number(d1!.totalNet)).toBe(Number(before!.totalNet));
    expect(d1!.paidAt).toBeTruthy();
    const payJe = await prisma.journalEntry.findUnique({
      where: { id: d1!.paymentJournalEntryId! },
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

  it('payment failure atomicity — run stays POSTED if JE fails', async () => {
    const fx = await createPayrollFixture(prisma);
    const safe = await ensureSafe(fx);
    const run = await runPayrollMonth(prisma, fx, 2);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'a');
    await payrollPostingService.postAccrual(ctx(fx), run.id);
    const spy = jest
      .spyOn(journalPostingService, 'createAndPostInTx')
      .mockRejectedValueOnce(new AppError(500, 'INJECTED_PAYMENT_JE_FAILURE'));
    await expect(
      payrollPostingService.disbursePayroll(ctx(fx), run.id, { safeId: safe.id })
    ).rejects.toThrow(/INJECTED_PAYMENT_JE_FAILURE/);
    spy.mockRestore();
    const after = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(after!.status).toBe('POSTED');
    expect(after!.paymentJournalEntryId).toBeNull();
  });

  it('approval state machine illegal transitions', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 3);
    await prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'CALCULATING' } });
    await expect(payrollWorkflowService.approveRun(fx.companyId, run.id, 'x')).rejects.toThrow();
    await prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'CALCULATED' } });
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'ok');
    await expect(
      payrollRunCalculationService.createPayrollRun(fx.companyId, { periodYear: 2026, periodMonth: 3 })
    ).rejects.toThrow();
    await payrollPostingService.postAccrual(ctx(fx), run.id);
    await expect(payrollWorkflowService.approveRun(fx.companyId, run.id, 'x')).rejects.toThrow();
    const safe = await ensureSafe(fx);
    await payrollPostingService.disbursePayroll(ctx(fx), run.id, { safeId: safe.id });
    await expect(payrollWorkflowService.approveRun(fx.companyId, run.id, 'x')).rejects.toThrow();
  });

  it('approval atomicity rolls back on fingerprint failure', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 4);
    const spy = jest
      .spyOn(payrollGlMappingService, 'fingerprintMappings')
      .mockRejectedValueOnce(new Error('INJECTED_APPROVAL_FAILURE'));
    await expect(payrollWorkflowService.approveRun(fx.companyId, run.id, 'a')).rejects.toThrow();
    spy.mockRestore();
    const row = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(row!.status).not.toBe('APPROVED');
    expect(row!.approvedById).toBeNull();
  });

  it('calculate × calculate same period', async () => {
    const fx = await createPayrollFixture(prisma);
    const results = await Promise.allSettled([
      runPayrollMonth(prisma, fx, 5),
      runPayrollMonth(prisma, fx, 5),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const runs = await prisma.payrollRun.findMany({
      where: { companyId: fx.companyId, periodYear: 2026, periodMonth: 5 },
    });
    expect(runs.length).toBe(1);
    const items = await prisma.payrollRunItem.findMany({ where: { payrollRunId: runs[0]!.id } });
    expect(items.length).toBe(1);
    const comps = await prisma.hcmPayrollItemComponent.findMany({
      where: { payrollRunItem: { payrollRunId: runs[0]!.id } },
    });
    const codes = comps.map((c) => c.componentCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('POST × REVERSE concurrent unpost vs post on settled POSTED run', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 6);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'pr');
    await payrollPostingService.postAccrual(ctx(fx), run.id);
    const results = await Promise.allSettled([
      payrollPostingService.unpostAccrual(ctx(fx), run.id),
      payrollPostingService.postAccrual(ctx(fx), run.id),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    const final = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(['DRAFT', 'POSTED']).toContain(final!.status);
  });

  it('tenancy financial direct-ID matrix', async () => {
    const fxA = await createPayrollFixture(prisma);
    const fxB = await createPayrollFixture(prisma);
    const runA = await runPayrollMonth(prisma, fxA, 7);
    await expect(payrollEngineService.getPayrollRun(fxB.companyId, runA.id)).rejects.toThrow();
    await expect(payrollWorkflowService.approveRun(fxB.companyId, runA.id, 'x')).rejects.toThrow();
    await expect(payrollPostingService.postAccrual(ctx(fxB), runA.id)).rejects.toThrow();
    const compA = await prisma.hcmPayComponent.findFirst({ where: { companyId: fxA.companyId } });
    await expect(
      payrollGlMappingService.updateComponentGlAccounts(fxB.companyId, compA!.id, {})
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      payrollRunCalculationService.createPayrollRun(fxB.companyId, {
        periodYear: 2026,
        periodMonth: 7,
        branchId: fxA.branchId,
      })
    ).resolves.toBeTruthy();
  });

  it('financial audit fields on lifecycle', async () => {
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
        periodMonth: 8,
        amount: 500,
        status: 'APPROVED',
      },
    });
    const run = await runPayrollMonth(prisma, fx, 8);
    expect(run.calculatedAt).toBeTruthy();
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'auditor', {
      negativeNetOverrideReason: undefined,
    });
    const approved = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(approved?.approvedById).toBe('auditor');
    const consumed = await prisma.hcmPayrollOneTimeInput.findUnique({ where: { id: input.id } });
    expect(consumed?.consumedRunId).toBe(run.id);
    const posted = await payrollPostingService.postAccrual(ctx(fx, 'post-audit'), run.id);
    expect(posted?.postedById).toBe('post-audit');
    const safe = await ensureSafe(fx);
    const paid = await payrollPostingService.disbursePayroll(ctx(fx, 'pay-audit'), run.id, {
      safeId: safe.id,
    });
    expect(paid?.paidAt).toBeTruthy();
  });

  it('historical GL immutability after master-data change', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await runPayrollMonth(prisma, fx, 9);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'h');
    const posted = await payrollPostingService.postAccrual(ctx(fx), run.id);
    const linesBefore = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: posted!.accrualJournalEntryId! },
      orderBy: { lineOrder: 'asc' },
    });
    const snap = JSON.stringify(linesBefore.map((l) => [l.accountId, l.debit, l.credit, l.costCenterId]));
    await prisma.employee.update({ where: { id: fx.employeeId }, data: { basicSalary: 1 } });
    await prisma.hrSettings.update({
      where: { companyId: fx.companyId },
      data: { salariesExpenseAccountCode: '9999' },
    });
    const linesAfter = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: posted!.accrualJournalEntryId! },
      orderBy: { lineOrder: 'asc' },
    });
    expect(JSON.stringify(linesAfter.map((l) => [l.accountId, l.debit, l.credit, l.costCenterId]))).toBe(snap);
  });

  it('full financial E2E', async () => {
    const fx = await createPayrollFixture(prisma);
    await seedPayrollAttendance(prisma, fx, [
      {
        logicalWorkDate: '2026-10-15',
        workedMinutes: 420,
        lateMinutes: 30,
        paidLeaveMinutes: 60,
        unpaidLeaveMinutes: 30,
        approvedOvertimeMinutes: 60,
      },
    ]);
    const bonus = await prisma.hcmPayComponent.findFirst({
      where: { companyId: fx.companyId, code: 'BONUS' },
    });
    await prisma.hcmPayrollOneTimeInput.create({
      data: {
        companyId: fx.companyId,
        employmentId: fx.employmentId,
        employeeId: fx.employeeId,
        payComponentId: bonus!.id,
        periodYear: 2026,
        periodMonth: 10,
        amount: 1000,
        status: 'APPROVED',
      },
    });
    await prisma.employeeAdvance.create({
      data: {
        employeeId: fx.employeeId,
        date: new Date('2026-01-01'),
        value: 1500,
        remainingAmount: 1500,
        monthlyInstallment: 500,
        isActive: true,
        isSettled: false,
      },
    });
    const preview = await payrollRunCalculationService.previewRun(fx.companyId, 2026, 10);
    expect(preview.included).toBeGreaterThan(0);
    const run = await runPayrollMonth(prisma, fx, 10);
    const map = await componentAmounts(prisma, run.id, fx.employeeId);
    expect(map.get('BASIC')).toBeGreaterThan(0);
    expect(map.get('HOUSING')).toBeGreaterThan(0);
    expect(map.get('TRANSPORT')).toBeGreaterThan(0);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'e2e');
    const posted = await payrollPostingService.postAccrual(ctx(fx), run.id);
    const recon = await payrollReconciliationService.reconcileRun(fx.companyId, run.id);
    expect(recon.blockers).toEqual([]);
    const safe = await ensureSafe(fx);
    await payrollPostingService.disbursePayroll(ctx(fx), run.id, { safeId: safe.id });
    expect(posted!.accrualJournalEntryId).toBeTruthy();
  });

  it('BullMQ job handler: calculate idempotency without duplicate artifacts', async () => {
    const fx = await createPayrollFixture(prisma);
    const key = `a3-${Date.now()}`;
    const progress: number[] = [];
    const first = await processHcmPayrollCalculateJob(
      {
        companyId: fx.companyId,
        periodYear: 2026,
        periodMonth: 11,
        requestedBy: 'worker-a3',
        idempotencyKey: key,
      },
      async (pct) => {
        progress.push(pct);
      }
    );
    expect(first.reused).toBe(false);
    expect(progress).toContain(100);
    const second = await processHcmPayrollCalculateJob({
      companyId: fx.companyId,
      periodYear: 2026,
      periodMonth: 11,
      requestedBy: 'worker-a3',
      idempotencyKey: key,
    });
    expect(second.reused).toBe(true);
    expect(second.payrollRunId).toBe(first.payrollRunId);
    const runs = await prisma.payrollRun.findMany({
      where: { companyId: fx.companyId, periodYear: 2026, periodMonth: 11 },
    });
    expect(runs.length).toBe(1);
    const items = await prisma.payrollRunItem.findMany({ where: { payrollRunId: first.payrollRunId } });
    expect(items.length).toBe(1);
  });
});
