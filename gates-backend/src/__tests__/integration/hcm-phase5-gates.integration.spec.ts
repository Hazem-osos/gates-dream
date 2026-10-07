/**
 * Phase 5.1 — time/leave payroll matrix, one-time inputs, accounting sample.
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { payrollRunCalculationService } from '../../modules/hr/services/payroll/payroll-run-calculation.service';
import { payrollWorkflowService } from '../../modules/hr/services/payroll/payroll-workflow.service';
import { payrollRuleEngineService } from '../../modules/hr/services/payroll/payroll-rule-engine.service';
import { payrollContextBuilderService } from '../../modules/hr/services/payroll/payroll-context-builder.service';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import { payrollPostingService } from '../../modules/hr/services/payroll-posting.service';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import { payrollReconciliationService } from '../../modules/hr/services/payroll/payroll-reconciliation.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM Phase 5.1 — gates', () => {
  jest.setTimeout(180_000);

  it('no double deduction: unpaid leave + early leave overlap', async () => {
    const fx = await createPayrollFixture(prisma);
    const ctx = await payrollContextBuilderService.buildEmployeeContext(
      fx.companyId,
      fx.employeeId,
      2026,
      7
    );
    ctx.vars.time_early_leave_minutes = 120;
    ctx.vars.leave_unpaid_minutes = 120;
    ctx.vars.time_unpaid_leave_minutes = 120;
    ctx.vars.time_early_leave_billable_minutes = 0;
    ctx.vars.time_late_billable_minutes = 0;
    ctx.time.earlyLeaveMinutes = 120;
    ctx.time.unpaidLeaveMinutes = 120;
    ctx.time.earlyLeaveBillableMinutes = 0;

    const rules = await payrollRuleEngineService.loadRules(fx.companyId, new Date('2026-07-31'));
    const result = await payrollRuleEngineService.calculateWithRules(ctx, rules);
    const unpaid = result.components.find((c) => c.componentCode === 'UNPAID_LEAVE')?.amount ?? 0;
    const early = result.components.find((c) => c.componentCode === 'EARLY_LEAVE')?.amount ?? 0;
    expect(unpaid).toBeGreaterThan(0);
    expect(early).toBe(0);
  });

  it('one-time input: not consumed until approve', async () => {
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
    const run = await payrollRunCalculationService.createPayrollRun(fx.companyId, {
      periodYear: 2026,
      periodMonth: 8,
    });
    const beforeApprove = await prisma.hcmPayrollOneTimeInput.findUnique({ where: { id: input.id } });
    expect(beforeApprove?.consumedRunId).toBeNull();
    expect(beforeApprove?.status).toBe('APPROVED');

    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'approver-gates');
    const afterApprove = await prisma.hcmPayrollOneTimeInput.findUnique({ where: { id: input.id } });
    expect(afterApprove?.consumedRunId).toBe(run.id);
    expect(afterApprove?.status).toBe('CONSUMED');
  });

  it('RULE_ENGINE post accrual: reconciliation pass and balanced journal', async () => {
    const fx = await createPayrollFixture(prisma);
    const run = await payrollRunCalculationService.createPayrollRun(fx.companyId, {
      periodYear: 2026,
      periodMonth: 9,
      branchId: fx.branchId,
      fiscalYearId: fx.fiscalYearId,
    });
    await payrollWorkflowService.approveRun(fx.companyId, run.id, 'acct-approver');
    const recon = await payrollReconciliationService.reconcileRun(fx.companyId, run.id);
    expect(recon.blockers).toEqual([]);

    const ctx = invoicePostingContextFromIds({
      companyId: fx.companyId,
      branchId: fx.branchId,
      fiscalYearId: fx.fiscalYearId,
      userId: 'test-poster',
    });
    const posted = await payrollPostingService.postAccrual(ctx, run.id);
    expect(posted.accrualJournalEntryId).toBeTruthy();
    const entry = await prisma.journalEntry.findUnique({
      where: { id: posted.accrualJournalEntryId! },
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

  it('calculate concurrency: single run row for period', async () => {
    const fx = await createPayrollFixture(prisma);
    const month = 10;
    const results = await Promise.allSettled([
      payrollRunCalculationService.createPayrollRun(fx.companyId, { periodYear: 2026, periodMonth: month }),
      payrollRunCalculationService.createPayrollRun(fx.companyId, { periodYear: 2026, periodMonth: month }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const runs = await prisma.payrollRun.findMany({
      where: { companyId: fx.companyId, periodYear: 2026, periodMonth: month },
    });
    expect(runs.length).toBe(1);
  });
});
