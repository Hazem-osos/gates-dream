/**
 * Wave 3 — M9 payroll engine integration test.
 * Run: npm run test:wave3-payroll
 */
import { PrismaClient } from '@prisma/client';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { payrollAdvanceService } from '../src/modules/hr/services/payroll-advance.service.js';
import { payrollEngineService } from '../src/modules/hr/services/payroll-engine.service.js';
import { payrollPostingService } from '../src/modules/hr/services/payroll-posting.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const SAFE_ID = '00000000-0000-0000-0000-000000000070';
const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000095';
const DEPT_ID = '00000000-0000-0000-0000-000000000096';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertClose(a: number, b: number, msg: string, eps = 0.05) {
  if (Math.abs(a - b) > eps) {
    throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
  }
}

async function assertJournalPostedBalanced(journalEntryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { lines: true },
  });
  assert(!!entry, 'Journal entry exists');
  assert(entry!.isPosted === true, 'Journal posted');
  const totals = journalPostingService.computeBaseTotals(
    entry!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(totals.debitBase, totals.creditBase, 'Journal balanced');
}

async function seedPayrollFixtures() {
  const accounts = [
    { code: '6100', arabicName: 'Salaries Expense', type: 'expense' },
    { code: '6110', arabicName: 'Employer Insurance Expense', type: 'expense' },
    { code: '2400', arabicName: 'Social Insurance Payable', type: 'liability' },
    { code: '2410', arabicName: 'Payroll Tax Payable', type: 'liability' },
    { code: '1420', arabicName: 'Employee Advances', type: 'asset' },
    { code: '2420', arabicName: 'Accrued Payroll', type: 'liability' },
    { code: '1070', arabicName: 'Payroll Cash', type: 'asset' },
  ];
  for (const a of accounts) {
    const existing = await prisma.account.findFirst({
      where: { companyId: COMPANY_ID, code: a.code },
    });
    if (!existing) {
      await prisma.account.create({
        data: {
          companyId: COMPANY_ID,
          code: a.code,
          arabicName: a.arabicName,
          accountType: a.type,
          isActive: true,
        },
      });
    }
  }

  const cashGl = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1070' },
  });
  assert(!!cashGl, 'Cash GL');

  await prisma.hrSettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {},
    create: {
      companyId: COMPANY_ID,
      salariesExpenseAccountCode: '6100',
      employerInsuranceExpenseAccountCode: '6110',
      socialInsurancePayableAccountCode: '2400',
      payrollTaxPayableAccountCode: '2410',
      employeeAdvancesAccountCode: '1420',
      accruedPayrollAccountCode: '2420',
    },
  });

  await prisma.safe.upsert({
    where: { id: SAFE_ID },
    update: { glAccountId: cashGl!.id },
    create: {
      id: SAFE_ID,
      companyId: COMPANY_ID,
      arabicName: 'Payroll Safe',
      code: 'SF-PAY',
      currencyCode: 'EGP',
      glAccountId: cashGl!.id,
      balance: 0,
    },
  });

  await prisma.department.upsert({
    where: { id: DEPT_ID },
    update: {},
    create: {
      id: DEPT_ID,
      companyId: COMPANY_ID,
      arabicName: 'Finance',
      code: 'FIN',
    },
  });

  await prisma.employee.updateMany({
    where: { companyId: COMPANY_ID, id: { not: EMPLOYEE_ID } },
    data: { isActive: false },
  });

  await prisma.employee.upsert({
    where: { id: EMPLOYEE_ID },
    update: {
      isActive: true,
      basicSalary: 10_000,
      fixedAllowances: 2_000,
      taxExemptionAmount: 1_000,
      socialInsuranceEnrolled: true,
      departmentId: DEPT_ID,
    },
    create: {
      id: EMPLOYEE_ID,
      companyId: COMPANY_ID,
      arabicName: 'Payroll Test Employee',
      basicSalary: 10_000,
      fixedAllowances: 2_000,
      taxExemptionAmount: 1_000,
      socialInsuranceEnrolled: true,
      departmentId: DEPT_ID,
      identityNumber: '29901011234567',
    },
  });

  await prisma.employeeAdvance.deleteMany({
    where: { employeeId: EMPLOYEE_ID },
  });

  await resetCurrentPayrollRun();
}

/**
 * Idempotency: one run per company/period is allowed, and an already-posted run rejects
 * the accrual step on a rerun.
 */
async function resetCurrentPayrollRun() {
  const now = new Date();
  const runs = await prisma.payrollRun.findMany({
    where: {
      companyId: COMPANY_ID,
      periodYear: now.getUTCFullYear(),
      periodMonth: now.getUTCMonth() + 1,
    },
    select: { id: true, accrualJournalEntryId: true, paymentJournalEntryId: true },
  });
  if (runs.length === 0) return;

  const journalIds = runs
    .flatMap((r) => [r.accrualJournalEntryId, r.paymentJournalEntryId])
    .filter((id): id is string => !!id);

  await prisma.payrollRunItem.deleteMany({
    where: { payrollRunId: { in: runs.map((r) => r.id) } },
  });
  await prisma.payrollRun.deleteMany({ where: { id: { in: runs.map((r) => r.id) } } });
  if (journalIds.length > 0) {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
  }
}

async function main() {
  console.log('Wave3 payroll integration test — start');

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fiscalYear, 'Run test:wave1-invoices for fiscal year fixture');

  await seedPayrollFixtures();

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave3-payroll-test',
  });

  await payrollAdvanceService.create(COMPANY_ID, {
    employeeId: EMPLOYEE_ID,
    date: new Date(),
    amount: 5_000,
    installmentAmount: 500,
  });

  const now = new Date();
  const run = await payrollEngineService.createPayrollRun(COMPANY_ID, {
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    periodMonth: now.getUTCMonth() + 1,
    periodYear: now.getUTCFullYear(),
    employeeInputs: {
      [EMPLOYEE_ID]: { overtime: 500 },
    },
  });

  assert(run.status === 'DRAFT', 'Run is draft');
  assert(run.items.length === 1, 'Single employee on run');
  const line = run.items[0];
  assertClose(Number(line.grossSalary), 12_500, 'Gross salary');
  assertClose(Number(line.advanceDeduction), 500, 'Advance installment');
  assertClose(Number(line.netSalary), 9_662, 'Net salary');

  const posted = await payrollPostingService.postAccrual(ctx, run.id);
  assert(posted.status === 'POSTED', 'Accrual posted');
  assert(!!posted.accrualJournalEntryId, 'Accrual JE');
  await assertJournalPostedBalanced(posted.accrualJournalEntryId!);

  const accrualEntry = await prisma.journalEntry.findUnique({
    where: { id: posted.accrualJournalEntryId! },
    include: { lines: { include: { account: true } } },
  });
  const accruedLine = accrualEntry!.lines.find((l) => l.account.code === '2420');
  assert(!!accruedLine, 'Accrued payroll credit line');
  assertClose(Number(accruedLine!.credit), 9_662, 'Accrued payroll amount');

  const advance = await prisma.employeeAdvance.findFirst({
    where: { employeeId: EMPLOYEE_ID, isActive: true },
  });
  assertClose(Number(advance!.remainingAmount), 4_500, 'Advance remaining after recovery');

  const paid = await payrollPostingService.disbursePayroll(ctx, run.id, {
    safeId: SAFE_ID,
  });
  assert(paid.status === 'PAID', 'Payroll paid');
  await assertJournalPostedBalanced(paid.paymentJournalEntryId!);

  const payEntry = await prisma.journalEntry.findUnique({
    where: { id: paid.paymentJournalEntryId! },
    include: { lines: { include: { account: true } } },
  });
  const accruedDebit = payEntry!.lines.find(
    (l) => l.account.code === '2420' && Number(l.debit) > 0
  );
  assert(!!accruedDebit, 'Accrued payroll debited on disbursement');
  assertClose(Number(accruedDebit!.debit), 9_662, 'Accrued cleared on disbursement');

  console.log('Wave3 payroll integration test — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
