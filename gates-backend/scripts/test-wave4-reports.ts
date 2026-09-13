/**
 * Wave 4 — M16 financial reporting integration test.
 * Run: npm run test:wave4-reports
 */
import { PrismaClient } from '@prisma/client';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { financialReportService } from '../src/modules/accounting/services/financial-report.service.js';
import { amountsEqualAt4, roundTo4 } from '../src/shared/utils/decimal-round.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function ensureAccount(code: string, arabicName: string, accountType: string) {
  const existing = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code },
  });
  if (existing) return existing.id;
  const created = await prisma.account.create({
    data: { companyId: COMPANY_ID, code, arabicName, accountType, isActive: true },
  });
  return created.id;
}

async function seedReportFixtures() {
  const suffix = String(Date.now()).slice(-4);
  for (const [name, value] of Object.entries({
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
  })) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  await prisma.fiscalYear.upsert({
    where: {
      companyId_legacyYearId: { companyId: COMPANY_ID, legacyYearId: '2026' },
    },
    update: { status: 'Open' },
    create: {
      id: FISCAL_YEAR_ID,
      companyId: COMPANY_ID,
      legacyYearId: '2026',
      arabicName: 'FY 2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.000Z'),
      status: 'Open',
    },
  });

  return {
    cashId: await ensureAccount(`110${suffix}`, 'W4 Cash', 'asset'),
    arId: await ensureAccount(`120${suffix}`, 'W4 AR', 'asset'),
    apId: await ensureAccount(`210${suffix}`, 'W4 AP', 'liability'),
    equityId: await ensureAccount(`300${suffix}`, 'W4 Equity', 'equity'),
    revenueId: await ensureAccount(`410${suffix}`, 'W4 Revenue', 'revenue'),
    cogsId: await ensureAccount(`510${suffix}`, 'W4 COGS', 'expense'),
    expenseId: await ensureAccount(`520${suffix}`, 'W4 OpEx', 'expense'),
  };
}

async function postAndPublish(
  ctx: { companyId: string; branchId: string; fiscalYearId: string; userId: string },
  date: Date,
  description: string,
  lines: Array<{ accountId: string; debit: number; credit: number; lineOrder: number }>
) {
  const entry = await journalPostingService.createJournalEntry(ctx, {
    date,
    description,
    currencyCode: 'EGP',
    lines,
  });
  await journalPostingService.postJournalEntry(ctx, entry.id);
  return entry.id;
}

async function main() {
  console.log('Wave4 M16 financial reports — start');
  const accounts = await seedReportFixtures();

  const ctx = {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave4-reports-test',
  };

  const periodStart = new Date('2026-02-01T00:00:00.000Z');
  const periodEnd = new Date('2026-02-28T23:59:59.000Z');
  const beforePeriod = new Date('2026-01-15T00:00:00.000Z');

  await postAndPublish(ctx, beforePeriod, 'Opening capital', [
    { accountId: accounts.cashId, debit: 10_000, credit: 0, lineOrder: 1 },
    { accountId: accounts.equityId, debit: 0, credit: 10_000, lineOrder: 2 },
  ]);

  await postAndPublish(ctx, new Date('2026-02-05'), 'Purchase on credit', [
    { accountId: accounts.cogsId, debit: 1_000, credit: 0, lineOrder: 1 },
    { accountId: accounts.apId, debit: 0, credit: 1_000, lineOrder: 2 },
  ]);

  await postAndPublish(ctx, new Date('2026-02-10'), 'Credit sale', [
    { accountId: accounts.arId, debit: 1_500, credit: 0, lineOrder: 1 },
    { accountId: accounts.revenueId, debit: 0, credit: 1_500, lineOrder: 2 },
  ]);

  await postAndPublish(ctx, new Date('2026-02-12'), 'Operating expense', [
    { accountId: accounts.expenseId, debit: 300, credit: 0, lineOrder: 1 },
    { accountId: accounts.cashId, debit: 0, credit: 300, lineOrder: 2 },
  ]);

  await postAndPublish(ctx, new Date('2026-02-20'), 'AP payment', [
    { accountId: accounts.apId, debit: 400, credit: 0, lineOrder: 1 },
    { accountId: accounts.cashId, debit: 0, credit: 400, lineOrder: 2 },
  ]);

  const tb = await financialReportService.getTrialBalance({
    companyId: COMPANY_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    startDate: periodStart,
    endDate: periodEnd,
  });
  assert(tb.verification.balanced, 'Trial balance ending debits = credits');
  assert(
    amountsEqualAt4(tb.verification.totalEndingDebit, tb.verification.totalEndingCredit),
    'Trial balance totals at 4dp'
  );

  const stmt = await financialReportService.getAccountStatement({
    companyId: COMPANY_ID,
    accountId: accounts.cashId,
    startDate: periodStart,
    endDate: periodEnd,
  });

  const expectedOpening = 10_000;
  assertClose(stmt.openingBalance, expectedOpening, 'Cash opening balance');
  let manualRun = expectedOpening;
  for (const tx of stmt.transactions) {
    manualRun = roundTo4(manualRun + tx.debitBase - tx.creditBase);
    assertClose(tx.runningBalance, manualRun, 'Running balance line');
  }
  assertClose(stmt.closingBalance, manualRun, 'Cash closing balance');

  const pl = await financialReportService.getIncomeStatement({
    companyId: COMPANY_ID,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: periodEnd,
  });

  const ourAccountIds = new Set(Object.values(accounts));
  const ourLines = pl.lines.filter((l) => ourAccountIds.has(l.accountId));
  const sumClass = (cls: string) =>
    roundTo4(
      ourLines.filter((l) => l.class === cls).reduce((s, l) => s + l.amount, 0)
    );

  assertClose(sumClass('REVENUE'), 1_500, 'P&L revenue (W4 accounts)');
  assertClose(sumClass('COGS'), 1_000, 'P&L COGS (W4 accounts)');
  assertClose(sumClass('EXPENSE'), 300, 'P&L expense (W4 accounts)');
  assertClose(
    roundTo4(sumClass('REVENUE') - sumClass('COGS') - sumClass('EXPENSE')),
    200,
    'P&L net profit (W4 accounts)'
  );

  const ourTb = tb.accounts.filter((a) => ourAccountIds.has(a.accountId));
  const assetTotal = roundTo4(
    ourTb
      .filter((a) => a.code.startsWith('1'))
      .reduce((s, a) => s + a.closingNet, 0)
  );
  const liabilityTotal = roundTo4(
    ourTb
      .filter((a) => a.code.startsWith('2'))
      .reduce((s, a) => s - a.closingNet, 0)
  );
  const equityTotal = roundTo4(
    ourTb
      .filter((a) => a.code.startsWith('3'))
      .reduce((s, a) => s - a.closingNet, 0)
  );
  const netIncome = roundTo4(sumClass('REVENUE') - sumClass('COGS') - sumClass('EXPENSE'));
  assert(
    amountsEqualAt4(assetTotal, liabilityTotal + equityTotal + netIncome),
    'W4 accounts: Assets = Liabilities + Equity + Net Income'
  );

  const bs = await financialReportService.getBalanceSheet({
    companyId: COMPANY_ID,
    asOfDate: periodEnd,
  });
  assert(typeof bs.verification.equationBalanced === 'boolean', 'Balance sheet returns verification');

  console.log('Wave4 M16 financial reports — PASSED');
}

function assertClose(a: number, b: number, msg: string) {
  if (!amountsEqualAt4(a, b)) {
    throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
