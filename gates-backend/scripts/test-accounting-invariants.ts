/**
 * Cross-module accounting invariants (posted JEs balanced, TB, BS equation).
 * Run: npm run test:accounting-invariants
 */
import { PrismaClient } from '@prisma/client';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { financialReportService } from '../src/modules/accounting/services/financial-report.service.js';
import { amountsEqualAt4 } from '../src/shared/utils/decimal-round.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function assertAllPostedJournalsBalanced(companyId: string) {
  const entries = await prisma.journalEntry.findMany({
    where: { companyId, isPosted: true, isCancelled: false, deletedAt: null },
    include: { lines: true },
    take: 5000,
  });

  for (const entry of entries) {
    const totals = journalPostingService.computeBaseTotals(
      entry.lines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
        exchangeRate: Number(l.exchangeRate),
      }))
    );
    assert(
      amountsEqualAt4(totals.debitBase, totals.creditBase),
      `JE ${entry.id} unbalanced (${totals.debitBase} vs ${totals.creditBase})`
    );
  }
}

async function main() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    console.log('Skip: Wave1 fixture company not seeded — run test:wave1-invoices first.');
    process.exit(0);
  }

  const fy = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fy, 'Fiscal year fixture');

  await assertAllPostedJournalsBalanced(COMPANY_ID);

  const tb = await financialReportService.getTrialBalance({
    companyId: COMPANY_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    startDate: fy!.startDate,
    endDate: fy!.endDate,
  });
  assert(tb.verification.balanced, 'Trial balance must balance');

  const bs = await financialReportService.getBalanceSheet({
    companyId: COMPANY_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    asOfDate: fy!.endDate,
  });
  assert(bs.verification.equationBalanced, 'Balance sheet equation must hold');

  const cashInvoices = await prisma.invoice.findMany({
    where: {
      companyId: COMPANY_ID,
      isPosted: true,
      paymentMethod: { in: ['cash', 'CASH', 'Cash'] },
    },
    select: { id: true, remainingAmount: true, paidAmount: true, netAmount: true },
    take: 50,
  });
  for (const inv of cashInvoices) {
    const remaining = Number(inv.remainingAmount);
    assert(
      remaining <= 0.0001,
      `Cash invoice ${inv.id} should be fully settled (remaining=${remaining})`
    );
  }

  const whtSales = await prisma.invoice.findMany({
    where: {
      companyId: COMPANY_ID,
      isPosted: true,
      invoiceKind: 'SALE',
      withholdingTaxAmount: { gt: 0 },
    },
    select: { id: true, journalEntryId: true },
    take: 20,
  });
  for (const inv of whtSales) {
    if (!inv.journalEntryId) continue;
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: inv.journalEntryId },
    });
    const debits = lines.reduce((s, l) => s + Number(l.debit), 0);
    const credits = lines.reduce((s, l) => s + Number(l.credit), 0);
    assert(amountsEqualAt4(debits, credits), `Sales WHT invoice JE ${inv.journalEntryId} balanced`);
  }

  const paidInvoices = await prisma.invoice.findMany({
    where: {
      companyId: COMPANY_ID,
      paymentStatus: 'PAID',
      isPosted: true,
    },
    select: { id: true, remainingAmount: true, paymentStatus: true },
    take: 100,
  });
  for (const inv of paidInvoices) {
    assert(
      Number(inv.remainingAmount) <= 0.0001,
      `PAID invoice ${inv.id} must have zero remaining`
    );
  }

  console.log('Accounting invariants OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
