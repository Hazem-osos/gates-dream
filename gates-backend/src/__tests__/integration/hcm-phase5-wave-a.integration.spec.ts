/**
 * Phase 5.1 Wave A — financial correctness integration.
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import {
  componentAmounts,
  seedPayrollAttendance,
} from '../helpers/hcm-payroll-wave-a.fixture';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';
import { payrollWorkflowService } from '../../modules/hr/services/payroll/payroll-workflow.service';
import { payrollPostingService } from '../../modules/hr/services/payroll-posting.service';
import { payrollReconciliationService } from '../../modules/hr/services/payroll/payroll-reconciliation.service';
import { payrollLocalizationService } from '../../modules/hr/services/payroll/payroll-localization.service';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

function postingCtx(fx: { companyId: string; branchId: string; fiscalYearId: string }) {
  return invoicePostingContextFromIds({
    companyId: fx.companyId,
    branchId: fx.branchId,
    fiscalYearId: fx.fiscalYearId,
    userId: 'wave-a-tester',
  });
}

async function calcMonth(
  fx: Awaited<ReturnType<typeof createPayrollFixture>>,
  periodMonth: number,
  days?: Parameters<typeof seedPayrollAttendance>[2]
) {
  if (days?.length) {
    await seedPayrollAttendance(prisma, fx, days);
  }
  return payrollRunCalculationService.createPayrollRun(fx.companyId, {
    periodYear: 2026,
    periodMonth,
    branchId: fx.branchId,
    fiscalYearId: fx.fiscalYearId,
  });
}

describeDb('HCM Phase 5.1 Wave A', () => {
  jest.setTimeout(300_000);

  describe('time/leave payroll matrix (monetary)', () => {
    const scenarios: Array<{
      name: string;
      month: number;
      days: Parameters<typeof seedPayrollAttendance>[2];
      expect: (m: Map<string, number>) => void;
    }> = [
      {
        name: 'normal worked period',
        month: 1,
        days: [{ logicalWorkDate: '2026-01-15', workedMinutes: 480, scheduledMinutes: 480 }],
        expect: (m) => {
          expect(m.get('BASIC')).toBeGreaterThan(0);
          expect(m.get('OVERTIME') ?? 0).toBe(0);
        },
      },
      {
        name: 'approved overtime',
        month: 2,
        days: [{ logicalWorkDate: '2026-02-10', approvedOvertimeMinutes: 120, workedMinutes: 600 }],
        expect: (m) => expect(m.get('OVERTIME') ?? 0).toBeGreaterThan(0),
      },
      {
        name: 'late',
        month: 3,
        days: [{ logicalWorkDate: '2026-03-10', lateMinutes: 45, workedMinutes: 435 }],
        expect: (m) => expect(m.get('LATE') ?? 0).toBeGreaterThan(0),
      },
      {
        name: 'early leave',
        month: 4,
        days: [{ logicalWorkDate: '2026-04-10', earlyLeaveMinutes: 60, workedMinutes: 420 }],
        expect: (m) => expect(m.get('EARLY_LEAVE') ?? 0).toBeGreaterThan(0),
      },
      {
        name: 'absence',
        month: 5,
        days: [{ logicalWorkDate: '2026-05-10', absenceMinutes: 480, workedMinutes: 0 }],
        expect: (m) => expect(m.get('ABSENCE') ?? 0).toBeGreaterThan(0),
      },
      {
        name: 'unpaid leave',
        month: 6,
        days: [{ logicalWorkDate: '2026-06-10', unpaidLeaveMinutes: 240, workedMinutes: 240 }],
        expect: (m) => expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0),
      },
      {
        name: 'sick leave',
        month: 7,
        days: [{ logicalWorkDate: '2026-07-10', sickLeaveMinutes: 480, workedMinutes: 0 }],
        expect: (m) => {
          expect(m.get('BASIC')).toBeGreaterThan(0);
        },
      },
      {
        name: 'overlap unpaid + early',
        month: 8,
        days: [
          {
            logicalWorkDate: '2026-08-10',
            unpaidLeaveMinutes: 120,
            earlyLeaveMinutes: 120,
            workedMinutes: 360,
          },
        ],
        expect: (m) => {
          expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0);
          expect(m.get('EARLY_LEAVE') ?? 0).toBe(0);
        },
      },
      {
        name: 'leave + late',
        month: 9,
        days: [
          {
            logicalWorkDate: '2026-09-10',
            unpaidLeaveMinutes: 60,
            lateMinutes: 30,
            workedMinutes: 390,
          },
        ],
        expect: (m) => {
          expect(m.get('UNPAID_LEAVE') ?? 0).toBeGreaterThan(0);
          expect(m.get('LATE') ?? 0).toBe(0);
        },
      },
      {
        name: 'paid leave + OT',
        month: 10,
        days: [
          {
            logicalWorkDate: '2026-10-10',
            paidLeaveMinutes: 120,
            approvedOvertimeMinutes: 60,
            workedMinutes: 420,
          },
        ],
        expect: (m) => expect(m.get('OVERTIME') ?? 0).toBeGreaterThan(0),
      },
    ];

    for (const sc of scenarios) {
      it(sc.name, async () => {
        const fx = await createPayrollFixture(prisma);
        const run = await calcMonth(fx, sc.month, sc.days);
        const map = await componentAmounts(prisma, run.id, fx.employeeId);
        sc.expect(map);
      });
    }
  });

  it('one-time input: parallel approve is idempotent on run state', async () => {
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
        periodMonth: 11,
        amount: 1000,
        status: 'APPROVED',
      },
    });
    const run = await calcMonth(fx, 11);
    const results = await Promise.allSettled([
      payrollWorkflowService.approveRun(fx.companyId, run.id, 'a1'),
      payrollWorkflowService.approveRun(fx.companyId, run.id, 'a2'),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const row = await prisma.hcmPayrollOneTimeInput.findUnique({ where: { id: input.id } });
    expect(row?.status).toBe('CONSUMED');
    expect(row?.consumedRunId).toBe(run.id);
  });

  it('advance recovery FIFO trace on components', async () => {
    const fx = await createPayrollFixture(prisma);
    await prisma.employeeAdvance.createMany({
      data: [
        {
          employeeId: fx.employeeId,
          date: new Date('2026-01-01'),
          value: 3000,
          remainingAmount: 3000,
          monthlyInstallment: 1000,
          isActive: true,
          isSettled: false,
        },
        {
          employeeId: fx.employeeId,
          date: new Date('2026-01-15'),
          value: 2000,
          remainingAmount: 2000,
          monthlyInstallment: 1500,
          isActive: true,
          isSettled: false,
        },
      ],
    });
    const run = await calcMonth(fx, 12);
    const comps = await prisma.hcmPayrollItemComponent.findMany({
      where: { payrollRunItem: { payrollRunId: run.id, employeeId: fx.employeeId } },
    });
    const adv = comps.filter((c) => c.componentCode === 'ADVANCE_RECOVERY');
    expect(adv.length).toBeGreaterThanOrEqual(1);
    expect(adv.some((c) => c.sourceRef)).toBe(true);
  });

  it('negative net BLOCK vs ALLOW_WITH_APPROVAL override', async () => {
    const fx = await createPayrollFixture(prisma);
    await prisma.hrSettings.update({
      where: { companyId: fx.companyId },
      data: { payrollNegativeNetPolicy: 'BLOCK' },
    });
    await prisma.employeeAdvance.create({
      data: {
        employeeId: fx.employeeId,
        date: new Date('2026-01-01'),
        value: 500000,
        remainingAmount: 500000,
        monthlyInstallment: 500000,
        isActive: true,
        isSettled: false,
      },
    });
    await expect(calcMonth(fx, 1)).rejects.toThrow(/NEGATIVE_NET_BLOCKED/);

    const fx2 = await createPayrollFixture(prisma);
    await prisma.hrSettings.update({
      where: { companyId: fx2.companyId },
      data: { payrollNegativeNetPolicy: 'ALLOW_WITH_APPROVAL' },
    });
    await prisma.employeeAdvance.create({
      data: {
        employeeId: fx2.employeeId,
        date: new Date('2026-01-01'),
        value: 500000,
        remainingAmount: 500000,
        monthlyInstallment: 500000,
        isActive: true,
        isSettled: false,
      },
    });
    const run2 = await calcMonth(fx2, 2);
    await expect(
      payrollWorkflowService.approveRun(fx2.companyId, run2.id, 'mgr')
    ).rejects.toThrow(/NEGATIVE_NET_REQUIRES_OVERRIDE/);
    await payrollWorkflowService.approveRun(fx2.companyId, run2.id, 'mgr', {
      negativeNetOverrideReason: 'Board approved exception',
    });
    const approved = await prisma.payrollRun.findUnique({ where: { id: run2.id } });
    expect(approved?.negativeNetOverrideReason).toContain('Board');
  });

  it('employer contribution does not reduce employee net', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await calcMonth(fx, 3);
    const item = await prisma.payrollRunItem.findFirst({
      where: { payrollRunId: run.id, employeeId: fx.employeeId },
      include: { components: true },
    });
    const er = item!.components.find((c) => c.componentType === 'EMPLOYER_CONTRIBUTION');
    const ee = item!.components.find((c) => c.componentCode === 'SOCIAL_INSURANCE_EE');
    expect(er).toBeTruthy();
    expect(ee).toBeTruthy();
    expect(Number(er!.amount)).toBeGreaterThan(0);
    expect(Number(item!.netSalary)).toBeLessThan(Number(item!.grossSalary));
  });

  it('posting idempotency POST × POST', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await calcMonth(fx, 4);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'poster');
    const ctx = postingCtx(fx);
    const results = await Promise.allSettled([
      payrollPostingService.postAccrual(ctx, run.id),
      payrollPostingService.postAccrual(ctx, run.id),
    ]);
    const posted = results.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof payrollPostingService.postAccrual>>>).value);
    expect(posted.length).toBeGreaterThanOrEqual(1);
    const jeId = posted[0]!.accrualJournalEntryId;
    expect(jeId).toBeTruthy();
    for (const p of posted) {
      expect(p!.accrualJournalEntryId).toBe(jeId);
    }
    const finalRun = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(finalRun?.accrualJournalEntryId).toBe(jeId);
    expect(finalRun?.status).toBe('POSTED');
  });

  it('historical GL + payroll after master data change', async () => {
    const fx = await createPayrollFixture(prisma);
    const cc = await prisma.costCenter.create({
      data: { companyId: fx.companyId, code: 'CC-SALES', arabicName: 'Sales' },
    });
    await prisma.employee.update({
      where: { id: fx.employeeId },
      data: { costCenterId: cc.id },
    });
    const run = await calcMonth(fx, 5);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'hist');
    const ctx = postingCtx(fx);
    const posted = await payrollPostingService.postAccrual(ctx, run.id);
    const jeBefore = await prisma.journalEntry.findUnique({
      where: { id: posted!.accrualJournalEntryId! },
      include: { lines: true },
    });
    const snapBefore = await prisma.hcmPayrollRunSnapshot.findUnique({
      where: { payrollRunId: run.id },
    });
    const itemBefore = await prisma.payrollRunItem.findFirst({
      where: { payrollRunId: run.id },
      include: { components: true },
    });

    await prisma.employee.update({
      where: { id: fx.employeeId },
      data: { basicSalary: 1 },
    });
    await prisma.hcmPayrollRule.updateMany({
      where: { companyId: fx.companyId },
      data: { formulaExpr: '0' },
    });

    const jeAfter = await prisma.journalEntry.findUnique({
      where: { id: posted!.accrualJournalEntryId! },
      include: { lines: true },
    });
    expect(jeAfter!.lines.length).toBe(jeBefore!.lines.length);
    expect(JSON.stringify(jeAfter!.lines)).toBe(JSON.stringify(jeBefore!.lines));

    const itemAfter = await prisma.payrollRunItem.findFirst({
      where: { payrollRunId: run.id },
      include: { components: true },
    });
    expect(Number(itemAfter!.netSalary)).toBe(Number(itemBefore!.netSalary));
    expect(snapBefore?.ruleSetFingerprint).toBeTruthy();
  });

  it('localization EG provider TEST statutory facts', async () => {
    const fx = await createPayrollFixture(prisma);
    const facts = await payrollLocalizationService.buildStatutoryFacts(
      fx.companyId,
      'EG',
      new Date('2026-06-15'),
      {
        employee: {
          employeeId: fx.employeeId,
          employmentId: fx.employmentId,
          countryCode: 'EG',
          socialInsuranceEnrolled: true,
          taxExemptionAmount: 0,
        },
        compensation: { byCode: { BASIC: 20000, HOUSING: 5000, TRANSPORT: 2000 } },
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
      }
    );
    expect(facts.statutory_employee_insurance_amount).toBeGreaterThan(0);
    expect(facts.statutory_employer_insurance_amount).toBeGreaterThan(0);
  });

  it('wave A financial E2E', async () => {
    const fx = await createPayrollFixture(prisma);
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
        periodMonth: 6,
        amount: 2500,
        status: 'APPROVED',
      },
    });
    await prisma.employeeAdvance.create({
      data: {
        employeeId: fx.employeeId,
        date: new Date('2026-01-01'),
        value: 1000,
        remainingAmount: 1000,
        monthlyInstallment: 500,
        isActive: true,
        isSettled: false,
      },
    });
    await seedPayrollAttendance(prisma, fx, [
      {
        logicalWorkDate: '2026-06-12',
        lateMinutes: 30,
        unpaidLeaveMinutes: 60,
        approvedOvertimeMinutes: 90,
        workedMinutes: 450,
      },
    ]);
    const run = await calcMonth(fx, 6);
    const map = await componentAmounts(prisma, run.id, fx.employeeId);
    expect(map.get('BASIC')).toBe(20000);
    expect(map.get('HOUSING')).toBe(5000);
    expect(map.get('BONUS')).toBe(2500);
    expect(map.get('OVERTIME') ?? 0).toBeGreaterThan(0);
    const recon = await payrollReconciliationService.reconcileRun(fx.companyId, run.id);
    expect(recon.blockers).toEqual([]);
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'e2e');
    const posted = await payrollPostingService.postAccrual(postingCtx(fx), run.id);
    const entry = await prisma.journalEntry.findUnique({
      where: { id: posted!.accrualJournalEntryId! },
      include: { lines: true },
    });
    const totals = journalPostingService.computeBaseTotals(
      entry!.lines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
        exchangeRate: Number(l.exchangeRate),
      }))
    );
    expect(Math.abs(totals.debitBase - totals.creditBase)).toBeLessThan(0.05);
  });
});
