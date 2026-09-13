/**
 * Wave 4 — M17 executive analytics + M22 batch ops & year-end close.
 * Run: npm run test:wave4-ops-analytics
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { executiveAnalyticsService, agingBucket } from '../src/modules/analytics/services/executive-analytics.service.js';
import { batchOperationsService } from '../src/modules/operations/services/batch-operations.service.js';
import { yearEndClosingService } from '../src/modules/operations/services/year-end-closing.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { financialReportService } from '../src/modules/accounting/services/financial-report.service.js';
import { treasuryPostingContextFromIds } from '../src/modules/treasury/services/treasury-posting-context.js';
import { roundTo4 } from '../src/shared/utils/decimal-round.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function seedGlFlags() {
  for (const [name, value] of Object.entries({
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
  })) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }
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

/**
 * Idempotency: this suite leaves synthetic aging invoices and deliberately-unposted batch
 * JEs behind, which would inflate the batch eligibility count and other suites' totals.
 */
async function resetFixtures() {
  const staleInvoices = await prisma.invoice.findMany({
    where: { companyId: COMPANY_ID, invoiceNumber: { startsWith: 'W4A' } },
    select: { id: true },
  });
  if (staleInvoices.length > 0) {
    const ids = staleInvoices.map((i) => i.id);
    await prisma.cashTransaction.deleteMany({ where: { invoiceId: { in: ids } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
    await prisma.invoice.deleteMany({ where: { id: { in: ids } } });
  }

  // `unpostJournalEntry` reverses by *creating* a balancing, itself-posted
  // reversal entry (`reversalOfJournalEntryId`) rather than deleting or
  // flipping `isPosted` in place. Every past run of `testBatchPostUnpost`
  // therefore leaves its 2 reversal entries behind (matched only by
  // `description: '\u0642\u064a\u062f \u0639\u0643\u0633\u064a...'`, not
  // `'W4 batch isolated'`), and each subsequent run's batch-unpost sees
  // those old reversals as freshly eligible too, chaining into a
  // reversal-of-a-reversal that grows every run. `batchFyId`/`batchDay` are
  // fixed constants (not randomized like `testYearEndClose`'s year), so
  // this whole date/fiscal-year window is exclusively this fixture's — wipe
  // every journal entry in it up front instead of filtering by description.
  const staleEntries = await prisma.journalEntry.findMany({
    where: {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      fiscalYearId: FISCAL_YEAR_ID,
      date: {
        gte: new Date(Date.UTC(2026, 11, 1)),
        lte: new Date(Date.UTC(2026, 11, 1, 23, 59, 59)),
      },
    },
    select: { id: true },
  });
  if (staleEntries.length > 0) {
    const ids = staleEntries.map((e) => e.id);
    // Other entries (reversals, possibly with a different description) can
    // reference these rows via `reversalOfJournalEntryId`; null out *any*
    // such reference — not just self-references within `ids` — or the
    // delete trips the FK constraint (same fixture bug as
    // test-phase2-inventory-ops.ts).
    await prisma.journalEntry.updateMany({
      where: { reversalOfJournalEntryId: { in: ids } },
      data: { reversalOfJournalEntryId: null },
    });
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: ids } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: ids } } });
  }
}

async function testAgingBuckets() {
  console.log('  • AR aging buckets');
  const asOf = new Date('2026-06-15T12:00:00.000Z');
  const tag = `W4A${Date.now().toString(36).slice(-5)}`;

  const specs = [
    { daysAgo: 10, amount: 100, expected: 'CURRENT' as const },
    { daysAgo: 45, amount: 200, expected: 'PAST_DUE_31_60' as const },
    { daysAgo: 75, amount: 300, expected: 'OVERDUE_61_90' as const },
    { daysAgo: 120, amount: 400, expected: 'DELINQUENT_90_PLUS' as const },
  ];

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const invDate = new Date(asOf);
    invDate.setUTCDate(invDate.getUTCDate() - s.daysAgo);
    await prisma.invoice.create({
      data: {
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        fiscalYearId: FISCAL_YEAR_ID,
        invoiceNumber: `${tag}-${i}`,
        invoiceKind: 'SALE',
        invoiceType: 'sales',
        date: invDate,
        customerId: CUSTOMER_ID,
        currencyCode: 'EGP',
        exchangeRate: 1,
        totalAmount: s.amount,
        netAmount: s.amount,
        remainingAmount: s.amount,
        isPosted: true,
        isCancelled: false,
      },
    });
    const days = Math.max(
      0,
      Math.floor((asOf.getTime() - invDate.getTime()) / (24 * 60 * 60 * 1000))
    );
    assert(agingBucket(days) === s.expected, `agingBucket(${days})`);
  }

  const report = await executiveAnalyticsService.getAgingReport({
    companyId: COMPANY_ID,
    asOfDate: asOf,
    partyType: 'CUSTOMER',
  });

  const row = report.parties.find((p) => p.partyId === CUSTOMER_ID);
  assert(!!row, 'Customer row in aging report');
  assert(roundTo4(row!.buckets.CURRENT) >= 100, 'CURRENT bucket includes recent invoice');
  assert(roundTo4(row!.buckets.PAST_DUE_31_60) >= 200, '31-60 bucket');
  assert(roundTo4(row!.buckets.OVERDUE_61_90) >= 300, '61-90 bucket');
  assert(roundTo4(row!.buckets.DELINQUENT_90_PLUS) >= 400, '90+ bucket');
}

async function testBatchPostUnpost(ctx: {
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  userId: string;
}) {
  console.log('  • Batch post / unpost (journal entries)');
  const batchFyId = FISCAL_YEAR_ID;
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

  const batchCtx = { ...ctx, fiscalYearId: batchFyId };
  const treasuryCtx = treasuryPostingContextFromIds(batchCtx);
  const batchDay = new Date('2026-12-01T00:00:00.000Z');
  const from = batchDay;
  const to = new Date('2026-12-01T23:59:59.000Z');

  const cashId = await ensureAccount('1100', 'Cash', 'asset');
  const eqId = await ensureAccount('3000', 'Equity', 'equity');

  for (let i = 0; i < 2; i++) {
    await journalPostingService.createJournalEntry(batchCtx, {
      date: batchDay,
      description: `W4 batch isolated ${Date.now()}-${i}`,
      currencyCode: 'EGP',
      lines: [
        { accountId: cashId, debit: 50, credit: 0, lineOrder: 1 },
        { accountId: eqId, debit: 0, credit: 50, lineOrder: 2 },
      ],
    });
  }

  const postResult = await batchOperationsService.batchPost(batchCtx, treasuryCtx, {
    companyId: batchCtx.companyId,
    branchId: batchCtx.branchId,
    fiscalYearId: batchFyId,
    documentType: 'JOURNAL_ENTRY',
    fromDate: from,
    toDate: to,
  });
  assert(postResult.totalEligible === 2, 'Exactly 2 eligible unposted JEs');
  assert(postResult.succeeded === 2, 'Batch post succeeded');
  assert(postResult.failed === 0, 'Batch post no failures');

  const unpostResult = await batchOperationsService.batchUnpost(batchCtx, treasuryCtx, {
    companyId: batchCtx.companyId,
    branchId: batchCtx.branchId,
    fiscalYearId: batchFyId,
    documentType: 'JOURNAL_ENTRY',
    fromDate: from,
    toDate: to,
  });
  assert(unpostResult.succeeded === 2, 'Batch unpost succeeded');
}

async function testYearEndClose(ctx: {
  companyId: string;
  branchId: string;
  userId: string;
}) {
  console.log('  • Fiscal year-end close');
  await seedGlFlags();

  const closeFyId = randomUUID();
  const legacyCloseId = `W4C${Date.now().toString(36)}`;
  // `% 30` only ever picks one of 30 years — re-running this script against the same
  // persistent dev DB (as happens repeatedly in this session) can land on a year already
  // closed by an earlier run, so `resolveForDate` matches that stale closed row instead of
  // this run's fresh one and every post below fails with "closed fiscal period". A much
  // wider, sparser range makes same-run collisions negligible. Stay within MySQL
  // DATETIME's year 9999 ceiling.
  const fyYear = 3000 + (Date.now() % 5_000);

  // Foundation fix: `closeFiscalYear` now enforces legacy `untYear.pas`'s
  // "every earlier fiscal year must already be closed" ordering rule. This
  // script has created a fresh far-future fiscal year on every run for a
  // long time without ever closing the earlier ones, so the dev DB has many
  // stray `Open` years scattered across the 3000-8000 range. Force-close
  // any of those still open before this run's year so the ordering check
  // (correctly) doesn't block this test on unrelated leftover fixtures.
  await prisma.fiscalYear.updateMany({
    where: {
      companyId: COMPANY_ID,
      status: { not: 'Close' },
      endDate: { lt: new Date(Date.UTC(fyYear, 11, 31, 23, 59, 59)) },
    },
    data: { status: 'Close' },
  });

  await prisma.fiscalYear.create({
    data: {
      id: closeFyId,
      companyId: COMPANY_ID,
      legacyYearId: legacyCloseId,
      arabicName: 'W4 Close FY',
      startDate: new Date(Date.UTC(fyYear, 0, 1)),
      endDate: new Date(Date.UTC(fyYear, 11, 31, 23, 59, 59)),
      status: 'Open',
    },
  });

  const suffix = String(Date.now()).slice(-4);
  const revenueId = await ensureAccount(`41${suffix}`, 'Sales W4', 'revenue');
  const expenseId = await ensureAccount(`52${suffix}`, 'OpEx W4', 'expense');
  const retainedId = await ensureAccount(`39${suffix}`, 'Retained W4', 'equity');
  const cashId = await ensureAccount(`11${suffix}`, 'Cash W4', 'asset');

  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: { retainedEarningsAccountId: retainedId },
    create: {
      companyId: COMPANY_ID,
      retainedEarningsAccountId: retainedId,
      allowNegativeBalance: false,
    },
  });

  const closeCtx = { ...ctx, fiscalYearId: closeFyId };

  const postBalanced = async (
    date: Date,
    description: string,
    lines: Array<{ accountId: string; debit: number; credit: number; lineOrder: number }>
  ) => {
    const entry = await journalPostingService.createJournalEntry(closeCtx, {
      date,
      description,
      currencyCode: 'EGP',
      lines,
    });
    await journalPostingService.postJournalEntry(closeCtx, entry.id);
  };

  const fyStart = new Date(Date.UTC(fyYear, 0, 1));
  const fyEnd = new Date(Date.UTC(fyYear, 11, 31, 23, 59, 59));

  await postBalanced(new Date(Date.UTC(fyYear, 2, 1)), 'W4 revenue', [
    { accountId: cashId, debit: 2400, credit: 0, lineOrder: 1 },
    { accountId: revenueId, debit: 0, credit: 2400, lineOrder: 2 },
  ]);
  await postBalanced(new Date(Date.UTC(fyYear, 3, 1)), 'W4 expense', [
    { accountId: expenseId, debit: 400, credit: 0, lineOrder: 1 },
    { accountId: cashId, debit: 0, credit: 400, lineOrder: 2 },
  ]);

  const plBefore = await financialReportService.getIncomeStatement({
    companyId: COMPANY_ID,
    fiscalYearId: closeFyId,
    startDate: fyStart,
    endDate: fyEnd,
  });
  assert(roundTo4(plBefore.netProfit) === 2000, 'Net profit before close is 2000');

  const closeResult = await yearEndClosingService.closeFiscalYear(closeCtx, closeFyId);
  assert(!!closeResult.closingJournalEntryId, 'Closing JE created');

  const fy = await prisma.fiscalYear.findUnique({ where: { id: closeFyId } });
  assert(fy?.status === 'Close', 'Fiscal year status Close');
  assert(fy?.closingJournalEntryId != null, 'closingJournalEntryId set');

  const plAfter = await financialReportService.getIncomeStatement({
    companyId: COMPANY_ID,
    fiscalYearId: closeFyId,
    startDate: fyStart,
    endDate: fyEnd,
  });
  assert(roundTo4(plAfter.netProfit) === 0, 'P&L net zero after year-end close');

  const retainedLines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: retainedId,
      journalEntryId: closeResult.closingJournalEntryId,
    },
  });
  const reCredit = retainedLines.reduce((s, l) => s + Number(l.creditBase), 0);
  assert(roundTo4(reCredit) === 2000, 'Retained earnings credited net income');

  let blocked = false;
  try {
    await journalPostingService.createJournalEntry(closeCtx, {
      date: new Date(Date.UTC(fyYear, 5, 1)),
      description: 'Should fail',
      currencyCode: 'EGP',
      lines: [
        { accountId: cashId, debit: 1, credit: 0, lineOrder: 1 },
        { accountId: revenueId, debit: 0, credit: 1, lineOrder: 2 },
      ],
    });
  } catch {
    blocked = true;
  }
  assert(blocked, 'Writes in closed fiscal year are blocked');
}

async function main() {
  console.log('Wave4 M17/M22 ops & analytics — start');
  await seedGlFlags();

  await prisma.fiscalYear.upsert({
    where: {
      companyId_legacyYearId: { companyId: COMPANY_ID, legacyYearId: '2026' },
    },
    update: {},
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

  const ctx = {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave4-ops-analytics-test',
  };

  await resetFixtures();

  await testAgingBuckets();
  await testYearEndClose(ctx);
  await testBatchPostUnpost(ctx);

  const kpis = await executiveAnalyticsService.getExecutiveKpis({
    companyId: COMPANY_ID,
    months: 3,
  });
  assert(typeof kpis.cashAndBankLiquidity === 'number', 'Executive KPIs liquidity');
  assert(kpis.pendingDocuments.total >= 0, 'Pending document counts');

  console.log('Wave4 M17/M22 ops & analytics — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
