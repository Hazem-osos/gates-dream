/**
 * Wave 1 — M7 tax / Dariba integration test.
 * Run: npm run test:wave1-taxes
 */
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { invoicePostingOrchestrator } from '../src/modules/invoices/services/invoice-posting-orchestrator.js';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { taxPeriodService } from '../src/modules/taxes/services/tax-period.service.js';
import { taxEngineService } from '../src/modules/taxes/services/tax-engine.service.js';
import { taxDeclarationPostingService } from '../src/modules/taxes/services/tax-declaration-posting.service.js';
import { treasuryPostingContextFromIds } from '../src/modules/treasury/services/treasury-posting-context.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { AppError } from '../src/shared/middleware/error-handler.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const ITEM_ID = '00000000-0000-0000-0000-000000000040';
const UNIT_ID = '00000000-0000-0000-0000-000000000041';
const SUPPLIER_ID = '00000000-0000-0000-0000-000000000050';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const TAX_PERIOD_ID = '00000000-0000-0000-0000-000000000080';

const TAX_PCT = 14;

// The declaration aggregates every posted invoice whose date falls in the period, so this
// suite owns a February window while the other wave suites post at "today".
const YEAR = new Date().getUTCFullYear();
const PERIOD_START = new Date(Date.UTC(YEAR, 1, 1));
const PERIOD_END = new Date(Date.UTC(YEAR, 1, 28, 23, 59, 59));
const DOC_DATE = new Date(Date.UTC(YEAR, 1, 15, 12, 0, 0));

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertClose(a: number, b: number, msg: string, eps = 0.02) {
  if (Math.abs(a - b) > eps) throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
}

function lineWithTax(qty: number, price: number, lineOrder: number) {
  const total = qty * price;
  const taxAmount = (total * TAX_PCT) / 100;
  return {
    itemId: ITEM_ID,
    unitId: UNIT_ID,
    quantity: qty,
    baseQuantity: qty,
    price,
    taxPercent: TAX_PCT,
    taxAmount,
    lineOrder,
  };
}

async function accountNetPosted(companyId: string, accountCode: string): Promise<number> {
  const account = await prisma.account.findFirst({
    where: { companyId, code: accountCode },
  });
  assert(!!account, `Account ${accountCode}`);
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: account!.id,
      journalEntry: { companyId, isPosted: true },
    },
  });
  let net = 0;
  for (const l of lines) {
    net += Number(l.debit) - Number(l.credit);
  }
  return net;
}

/**
 * Idempotency: the declaration aggregates every posted invoice in the period, so leftovers
 * from an earlier run double the expected VAT and a SETTLED/CLOSED period blocks the rerun.
 */
async function resetTaxFixtures() {
  const stale = await prisma.invoice.findMany({
    where: {
      companyId: COMPANY_ID,
      OR: [
        { invoiceNumber: { startsWith: 'PI-TAX-' } },
        { invoiceNumber: { startsWith: 'SI-TAX-' } },
        { invoiceNumber: { startsWith: 'PI-BLOCK-' } },
      ],
    },
    select: { id: true, journalEntryId: true, costJournalEntryId: true },
  });

  const staleIds = stale.map((i) => i.id);
  if (staleIds.length > 0) {
    const staleJournalIds = stale
      .flatMap((i) => [i.journalEntryId, i.costJournalEntryId])
      .filter((id): id is string => !!id);

    await prisma.cashTransaction.deleteMany({ where: { invoiceId: { in: staleIds } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: staleIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: staleIds } } });
    if (staleJournalIds.length > 0) {
      await prisma.journalEntryLine.deleteMany({
        where: { journalEntryId: { in: staleJournalIds } },
      });
      await prisma.journalEntry.deleteMany({ where: { id: { in: staleJournalIds } } });
    }
  }

  const declarations = await prisma.taxDeclaration.findMany({
    where: { companyId: COMPANY_ID, taxPeriodId: TAX_PERIOD_ID },
    select: { id: true, settlementJournalEntryId: true },
  });
  const settlementJeIds = declarations
    .map((d) => d.settlementJournalEntryId)
    .filter((id): id is string => !!id);
  if (declarations.length > 0) {
    await prisma.taxDeclaration.deleteMany({
      where: { id: { in: declarations.map((d) => d.id) } },
    });
  }
  if (settlementJeIds.length > 0) {
    await prisma.journalEntryLine.deleteMany({
      where: { journalEntryId: { in: settlementJeIds } },
    });
    await prisma.journalEntry.deleteMany({ where: { id: { in: settlementJeIds } } });
  }

  // Deleting the invoices above does not unwind the party balances they moved, and the
  // sale below would otherwise trip the customer credit limit on a rerun.
  await prisma.customer.update({ where: { id: CUSTOMER_ID }, data: { balance: 0 } });
  await prisma.supplier.update({ where: { id: SUPPLIER_ID }, data: { balance: 0 } });
}

async function seedTaxPeriod() {
  const year = YEAR;
  const start = PERIOD_START;
  const end = PERIOD_END;

  await prisma.taxPeriod.upsert({
    where: {
      companyId_fiscalYearId_periodNumber: {
        companyId: COMPANY_ID,
        fiscalYearId: FISCAL_YEAR_ID,
        periodNumber: 1,
      },
    },
    update: { status: 'OPEN', startDate: start, endDate: end },
    create: {
      id: TAX_PERIOD_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      fiscalYearId: FISCAL_YEAR_ID,
      periodNumber: 1,
      periodName: `FY${year} P1`,
      startDate: start,
      endDate: end,
      status: 'OPEN',
      sourceYearId: String(year),
    },
  });

  // Merge into whatever accountDefinitions other shared-fixture scripts already set
  // instead of clobbering them (this company row is reused across all wave*.ts scripts).
  const existingTaxSettings = await prisma.companySettings.findUnique({ where: { companyId: COMPANY_ID } });
  const existingTaxDefs = (existingTaxSettings?.accountDefinitions as Record<string, string>) ?? {};
  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      accountDefinitions: {
        ...existingTaxDefs,
        inventoryAccount: '1300',
        salesRevenueAccount: '4100',
        cogsAccount: '5100',
        vatInputAccount: '2200',
        vatOutputAccount: '2300',
        taxAuthorityPayableAccount: '2500',
        arAccount: '1200',
        apAccount: '2100',
      },
    },
    create: {
      companyId: COMPANY_ID,
      accountDefinitions: {
        inventoryAccount: '1300',
        salesRevenueAccount: '4100',
        cogsAccount: '5100',
        vatInputAccount: '2200',
        vatOutputAccount: '2300',
        taxAuthorityPayableAccount: '2500',
        arAccount: '1200',
        apAccount: '2100',
      },
    },
  });

  for (const [code, name, type] of [
    ['2500', 'Tax Authority Payable', 'liability'],
  ]) {
    const ex = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code } });
    if (!ex) {
      await prisma.account.create({
        data: { companyId: COMPANY_ID, code, arabicName: name, accountType: type, isActive: true },
      });
    }
  }
}

async function main() {
  console.log('Wave1 taxes integration test — start');

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fiscalYear, 'Fiscal year from M5 fixtures');

  await seedTaxPeriod();
  await resetTaxFixtures();

  const invCtx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave1-tax-test',
  });
  const taxCtx = treasuryPostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave1-tax-test',
  });

  const pi = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, FISCAL_YEAR_ID, {
    invoiceKind: 'PURCHASE',
    invoiceNumber: `PI-TAX-${Date.now()}`,
    date: DOC_DATE,
    currencyCode: 'EGP',
    supplierId: SUPPLIER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [lineWithTax(10, 100, 1)],
  });
  await invoicePostingOrchestrator.post(invCtx, pi!.id);

  const si = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, FISCAL_YEAR_ID, {
    invoiceKind: 'SALE',
    invoiceNumber: `SI-TAX-${Date.now()}`,
    date: DOC_DATE,
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [lineWithTax(4, 150, 1)],
  });
  await invoicePostingOrchestrator.post(invCtx, si!.id);

  const declaration = await taxEngineService.buildOrRefreshDeclaration(
    COMPANY_ID,
    TAX_PERIOD_ID
  );
  assertClose(Number(declaration.totalInputVat), 140, 'Input VAT from PI');
  assertClose(Number(declaration.totalOutputVat), 84, 'Output VAT from SI');
  assertClose(Number(declaration.netVatAmount), -56, 'Net VAT (recoverable)');

  const outputBefore = await accountNetPosted(COMPANY_ID, '2300');
  const inputBefore = await accountNetPosted(COMPANY_ID, '2200');

  const settled = await taxDeclarationPostingService.postVatSettlement(
    taxCtx,
    declaration.id
  );
  assert(settled.status === 'SETTLED', 'Declaration settled');
  assert(!!settled.settlementJournalEntryId, 'Settlement JE linked');

  const settlementJe = await prisma.journalEntry.findUnique({
    where: { id: settled.settlementJournalEntryId! },
    include: { lines: true },
  });
  const totals = journalPostingService.computeBaseTotals(
    settlementJe!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(totals.debitBase, totals.creditBase, 'Settlement JE balanced');

  // The VAT accounts also carry activity from the other wave suites on this company, so
  // measure the settlement as a delta: it must debit back the output VAT it declared and
  // credit back the input VAT it reclaimed.
  const outputAfter = await accountNetPosted(COMPANY_ID, '2300');
  const inputAfter = await accountNetPosted(COMPANY_ID, '2200');
  assertClose(outputAfter - outputBefore, 84, 'Settlement clears declared output VAT');
  assertClose(inputAfter - inputBefore, -140, 'Settlement clears declared input VAT');

  await taxPeriodService.close(COMPANY_ID, TAX_PERIOD_ID);
  let blocked = false;
  try {
    const pi2 = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, FISCAL_YEAR_ID, {
      invoiceKind: 'PURCHASE',
      invoiceNumber: `PI-BLOCK-${Date.now()}`,
      date: DOC_DATE,
      currencyCode: 'EGP',
      supplierId: SUPPLIER_ID,
      warehouseId: WAREHOUSE_ID,
      sourceYearId: fiscalYear!.legacyYearId,
      lines: [lineWithTax(1, 10, 1)],
    });
    await invoicePostingOrchestrator.post(invCtx, pi2!.id);
  } catch (e) {
    blocked = e instanceof AppError && e.statusCode === 403;
  }
  assert(blocked, 'Closed tax period blocks invoice posting');

  console.log('Wave1 taxes integration test — PASSED');
}

main()
  .catch((e) => {
    console.error('Wave1 taxes integration test — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
