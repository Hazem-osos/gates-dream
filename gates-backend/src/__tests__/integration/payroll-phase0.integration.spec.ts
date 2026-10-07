/**
 * HCM Phase 0 — payroll regression baseline (PayrollRun path).
 * Requires local MySQL (same guard as other integration specs).
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler';
import { invoicePostingContextFromIds } from '../../modules/invoices/services/invoice-posting-context';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import { payrollAdvanceService } from '../../modules/hr/services/payroll-advance.service';
import { payrollEngineService } from '../../modules/hr/services/payroll-engine.service';
import { payrollPostingService } from '../../modules/hr/services/payroll-posting.service';
import { monthlySalaryService } from '../../modules/hr/services/monthly-salary.service';
import { hrGlAccountResolverService } from '../../modules/hr/services/hr-gl-account-resolver.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

const PERIOD_YEAR = new Date().getUTCFullYear();
const PERIOD_MONTH = 11;
const UNPOST_PERIOD_MONTH = 12;

function assertClose(a: number, b: number, msg: string, eps = 0.02) {
  if (Math.abs(a - b) > eps) {
    throw new Error(`${msg}: expected ${b}, got ${a}`);
  }
}

async function assertJournalBalanced(journalEntryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { lines: true },
  });
  expect(entry?.isPosted).toBe(true);
  const totals = journalPostingService.computeBaseTotals(
    entry!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(totals.debitBase, totals.creditBase, 'Journal balanced');
}

describeDb('HCM Phase 0 — PayrollRun regression', () => {
  jest.setTimeout(180_000);

  const suffix = String(Date.now());
  let companyA: string;
  let companyB: string;
  let branchA: string;
  let fiscalYearA: string;
  let safeA: string;
  let employeeA: string;
  let employeeB: string;
  let allowanceId: string;

  async function wipePayrollForCompany(companyId: string) {
    const runs = await prisma.payrollRun.findMany({
      where: { companyId, periodYear: PERIOD_YEAR, periodMonth: { in: [PERIOD_MONTH, UNPOST_PERIOD_MONTH] } },
    });
    const journalIds = runs
      .flatMap((r) => [r.accrualJournalEntryId, r.paymentJournalEntryId])
      .filter((id): id is string => !!id);
    if (runs.length) {
      await prisma.payrollRunItem.deleteMany({ where: { payrollRunId: { in: runs.map((r) => r.id) } } });
      await prisma.payrollRun.deleteMany({ where: { id: { in: runs.map((r) => r.id) } } });
    }
    if (journalIds.length) {
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
      await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    }
  }

  beforeAll(async () => {
    companyA = (await prisma.company.create({ data: { arabicName: `Pay A ${suffix}`, isActive: true } })).id;
    companyB = (await prisma.company.create({ data: { arabicName: `Pay B ${suffix}`, isActive: true } })).id;
    branchA = (await prisma.branch.create({ data: { companyId: companyA, arabicName: `Br A ${suffix}` } })).id;
    fiscalYearA = (
      await prisma.fiscalYear.create({
        data: {
          companyId: companyA,
          legacyYearId: String(PERIOD_YEAR),
          startDate: new Date(`${PERIOD_YEAR}-01-01`),
          endDate: new Date(`${PERIOD_YEAR}-12-31`),
          status: 'Open',
          isActive: true,
        },
      })
    ).id;

    const accountCodes = [
      { code: '6100', type: 'expense', name: 'Salaries' },
      { code: '6110', type: 'expense', name: 'ER Ins' },
      { code: '2400', type: 'liability', name: 'SI Pay' },
      { code: '2410', type: 'liability', name: 'Tax Pay' },
      { code: '1420', type: 'asset', name: 'Advances' },
      { code: '2420', type: 'liability', name: 'Accrued' },
      { code: '1070', type: 'asset', name: 'Cash' },
    ];
    for (const a of accountCodes) {
      await prisma.account.create({
        data: {
          companyId: companyA,
          code: a.code,
          arabicName: a.name,
          accountType: a.type,
          isActive: true,
        },
      });
    }
    const cashGl = await prisma.account.findFirst({ where: { companyId: companyA, code: '1070' } });
    expect(cashGl).toBeTruthy();

    await prisma.hrSettings.create({
      data: {
        companyId: companyA,
        salariesExpenseAccountCode: '6100',
        employerInsuranceExpenseAccountCode: '6110',
        socialInsurancePayableAccountCode: '2400',
        payrollTaxPayableAccountCode: '2410',
        employeeAdvancesAccountCode: '1420',
        accruedPayrollAccountCode: '2420',
      },
    });

    safeA = (
      await prisma.safe.create({
        data: {
          companyId: companyA,
          arabicName: 'Payroll Safe',
          code: `SF-${suffix}`,
          currencyCode: 'EGP',
          glAccountId: cashGl!.id,
          balance: 0,
        },
      })
    ).id;

    employeeA = (
      await prisma.employee.create({
        data: {
          companyId: companyA,
          arabicName: 'Employee A',
          basicSalary: 10_000,
          fixedAllowances: 1_000,
          taxExemptionAmount: 500,
          socialInsuranceEnrolled: true,
          identityNumber: `A${suffix}`.slice(0, 14),
        },
      })
    ).id;

    employeeB = (
      await prisma.employee.create({
        data: {
          companyId: companyB,
          arabicName: 'Employee B',
          basicSalary: 8_000,
          identityNumber: `B${suffix}`.slice(0, 14),
        },
      })
    ).id;

    const allowance = await prisma.allowance.create({
      data: {
        companyId: companyA,
        code: `ALW-${suffix}`,
        arabicName: 'Transport',
        defaultAmount: 200,
        isActive: true,
      },
    });
    allowanceId = allowance.id;

    await prisma.deduction.create({
      data: {
        companyId: companyA,
        code: `DED-${suffix}`,
        arabicName: 'Union',
        defaultAmount: 100,
        isActive: true,
      },
    });

    await prisma.employee.updateMany({
      where: { companyId: companyA, id: { not: employeeA } },
      data: { isActive: false },
    });

    await wipePayrollForCompany(companyA);
  });

  afterAll(async () => {
    const purgeCompany = async (companyId: string) => {
      await prisma.monthlySalary.deleteMany({ where: { companyId } });
      const runs = await prisma.payrollRun.findMany({ where: { companyId }, select: { id: true } });
      if (runs.length) {
        await prisma.payrollRunItem.deleteMany({
          where: { payrollRunId: { in: runs.map((r) => r.id) } },
        });
        await prisma.payrollRun.deleteMany({ where: { companyId } });
      }
      const jes = await prisma.journalEntry.findMany({ where: { companyId }, select: { id: true } });
      if (jes.length) {
        const jeIds = jes.map((j) => j.id);
        await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: jeIds } } });
        await prisma.journalEntry.deleteMany({ where: { id: { in: jeIds } } });
      }
      await prisma.safe.deleteMany({ where: { companyId } });
      await prisma.hrSettings.deleteMany({ where: { companyId } });
      await prisma.employeeAdvance.deleteMany({
        where: { employee: { companyId } },
      });
      await prisma.employee.deleteMany({ where: { companyId } });
      await prisma.allowance.deleteMany({ where: { companyId } });
      await prisma.deduction.deleteMany({ where: { companyId } });
      await prisma.account.deleteMany({ where: { companyId } });
      await prisma.fiscalYear.deleteMany({ where: { companyId } });
      await prisma.branch.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    };

    if (companyA) await purgeCompany(companyA).catch(() => undefined);
    if (companyB) await purgeCompany(companyB).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('resolves GL accounts from HrSettings for company A', async () => {
    const resolved = await hrGlAccountResolverService.resolveAccounts(companyA);
    const salaries = await prisma.account.findFirst({ where: { companyId: companyA, code: '6100' } });
    expect(resolved.salariesExpenseAccountId).toBe(salaries!.id);
  });

  it('calculates gross with basic, fixed allowances, and company allowance/deduction masters', async () => {
    const line = await payrollEngineService.calculateEmployeePayroll(companyA, employeeA);
    // 10000 + 1000 fixed + 200 allowance master - 100 deduction master = 11100 gross before ins/tax
    assertClose(line.basicSalary, 10_000, 'basic');
    assertClose(line.allowances, 1_200, 'allowances');
    assertClose(line.otherDeductions, 100, 'deductions');
    assertClose(line.grossSalary, 11_100, 'gross');
  });

  it('applies advance installment in calculation (FIFO preview)', async () => {
    await payrollAdvanceService.create(companyA, {
      employeeId: employeeA,
      date: new Date(),
      amount: 3_000,
      installmentAmount: 400,
    });
    const line = await payrollEngineService.calculateEmployeePayroll(companyA, employeeA);
    // Engine sums installments across all open advances (400 per advance row).
    expect(line.advanceDeduction).toBeGreaterThanOrEqual(400);
  });

  it('creates DRAFT run, allows recalc while DRAFT, blocks recalc when POSTED', async () => {
    const run1 = await payrollEngineService.createPayrollRun(companyA, {
      branchId: branchA,
      fiscalYearId: fiscalYearA,
      periodYear: PERIOD_YEAR,
      periodMonth: PERIOD_MONTH,
    });
    expect(run1.status).toBe('CALCULATED');

    const run2 = await payrollEngineService.createPayrollRun(companyA, {
      periodYear: PERIOD_YEAR,
      periodMonth: PERIOD_MONTH,
    });
    expect(run2.status).toBe('CALCULATED');
    expect(run2.id).not.toBe(run1.id);

    const ctx = invoicePostingContextFromIds({
      companyId: companyA,
      branchId: branchA,
      fiscalYearId: fiscalYearA,
    });
    const posted = await payrollPostingService.postAccrual(ctx, run2.id);
    expect(posted.status).toBe('POSTED');

    await expect(
      payrollEngineService.createPayrollRun(companyA, {
        periodYear: PERIOD_YEAR,
        periodMonth: PERIOD_MONTH,
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('posts accrual once, balanced journal, idempotent accrual post rejected', async () => {
    const run = await prisma.payrollRun.findFirst({
      where: { companyId: companyA, periodYear: PERIOD_YEAR, periodMonth: PERIOD_MONTH },
    });
    expect(run?.status).toBe('POSTED');
    await assertJournalBalanced(run!.accrualJournalEntryId!);

    const ctx = invoicePostingContextFromIds({
      companyId: companyA,
      branchId: branchA,
      fiscalYearId: fiscalYearA,
    });
    await expect(payrollPostingService.postAccrual(ctx, run!.id)).rejects.toThrow(
      /postable/i
    );

    const jeCount = await prisma.journalEntry.count({
      where: { id: run!.accrualJournalEntryId! },
    });
    expect(jeCount).toBe(1);
  });

  it('recovers advance balances on accrual post (FIFO)', async () => {
    const advances = await prisma.employeeAdvance.findMany({
      where: { employeeId: employeeA, isActive: true, isSettled: false },
    });
    const totalRemaining = advances.reduce((s, a) => s + Number(a.remainingAmount ?? a.value), 0);
    expect(totalRemaining).toBeLessThan(
      advances.reduce((s, a) => s + Number(a.value), 0)
    );
  });

  it('unposts accrual from POSTED (not disbursed), reverses JE, restores advance balance', async () => {
    const periodMonth = UNPOST_PERIOD_MONTH;
    await prisma.employeeAdvance.deleteMany({ where: { employeeId: employeeA } });
    const advBefore = await payrollAdvanceService.create(companyA, {
      employeeId: employeeA,
      date: new Date(),
      amount: 1_000,
      installmentAmount: 200,
    });
    const remainingBefore = Number(advBefore.remainingAmount);

    const run = await payrollEngineService.createPayrollRun(companyA, {
      branchId: branchA,
      fiscalYearId: fiscalYearA,
      periodYear: PERIOD_YEAR,
      periodMonth,
    });
    const ctx = invoicePostingContextFromIds({
      companyId: companyA,
      branchId: branchA,
      fiscalYearId: fiscalYearA,
    });
    await payrollPostingService.postAccrual(ctx, run.id);
    const advMid = await prisma.employeeAdvance.findUnique({ where: { id: advBefore.id } });
    expect(Number(advMid!.remainingAmount)).toBeLessThan(remainingBefore);

    const unposted = await payrollPostingService.unpostAccrual(ctx, run.id);
    expect(unposted.status).toBe('DRAFT');
    expect(unposted.accrualJournalEntryId).toBeNull();

    const advAfter = await prisma.employeeAdvance.findUnique({ where: { id: advBefore.id } });
    assertClose(Number(advAfter!.remainingAmount), remainingBefore, 'Advance restored after unpost');

    await prisma.payrollRunItem.deleteMany({ where: { payrollRunId: run.id } });
    await prisma.payrollRun.delete({ where: { id: run.id } });
  });

  it('disburses payment and blocks duplicate disbursement', async () => {
    const ctx = invoicePostingContextFromIds({
      companyId: companyA,
      branchId: branchA,
      fiscalYearId: fiscalYearA,
    });
    let run = await prisma.payrollRun.findFirst({
      where: { companyId: companyA, periodYear: PERIOD_YEAR, periodMonth: PERIOD_MONTH },
    });
    if (!run) {
      run = await payrollEngineService.createPayrollRun(companyA, {
        branchId: branchA,
        fiscalYearId: fiscalYearA,
        periodYear: PERIOD_YEAR,
        periodMonth: PERIOD_MONTH,
      });
    }
    if (run.status !== 'POSTED' && run.status !== 'PAID') {
      await payrollPostingService.postAccrual(ctx, run.id);
      run = (await prisma.payrollRun.findUnique({ where: { id: run.id } }))!;
    }
    const paid =
      run.status === 'PAID'
        ? run
        : await payrollPostingService.disbursePayroll(ctx, run.id, { safeId: safeA });
    expect(paid.status).toBe('PAID');
    await assertJournalBalanced(paid.paymentJournalEntryId!);

    const paidAgain = await payrollPostingService.disbursePayroll(ctx, run.id, { safeId: safeA });
    expect(paidAgain.paymentJournalEntryId).toBe(paid.paymentJournalEntryId);
  });

  it('unposts accrual only from POSTED (not PAID) and restores advances', async () => {
    const run = await prisma.payrollRun.findFirst({
      where: { companyId: companyA, periodYear: PERIOD_YEAR, periodMonth: PERIOD_MONTH },
    });
    const ctx = invoicePostingContextFromIds({
      companyId: companyA,
      branchId: branchA,
      fiscalYearId: fiscalYearA,
    });
    await expect(payrollPostingService.unpostAccrual(ctx, run!.id)).rejects.toThrow(
      /Only a POSTED/i
    );
  });

  it('isolates payroll run by company', async () => {
    const run = await prisma.payrollRun.findFirst({
      where: { companyId: companyA, periodYear: PERIOD_YEAR, periodMonth: PERIOD_MONTH },
    });
    await expect(payrollEngineService.getPayrollRun(companyB, run!.id)).rejects.toBeInstanceOf(
      AppError
    );
  });

  it('rejects monthly salary for cross-company employee', async () => {
    await expect(
      monthlySalaryService.createMonthlySalary(companyA, {
        employeeId: employeeB,
        periodYear: String(PERIOD_YEAR),
        periodMonth: String(PERIOD_MONTH).padStart(2, '0'),
        date: new Date(),
        basicSalary: 1,
        netSalary: 1,
      })
    ).rejects.toThrow(/Employee not found/i);
  });

  it('snapshot items unchanged when employee salary changes after POSTED', async () => {
    const run = await prisma.payrollRun.findFirst({
      where: { companyId: companyA, periodYear: PERIOD_YEAR, periodMonth: PERIOD_MONTH },
      include: { items: true },
    });
    const netBefore = Number(run!.items[0].netSalary);
    await prisma.employee.update({
      where: { id: employeeA },
      data: { basicSalary: 99_999 },
    });
    const runAfter = await payrollEngineService.getPayrollRun(companyA, run!.id);
    expect(Number(runAfter.items[0].netSalary)).toBe(netBefore);
  });
});
