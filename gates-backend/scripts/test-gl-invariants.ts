/**
 * Phase 0 — GL invariant regression suite.
 *
 * These are the invariants every posting path must uphold. They run against a
 * dedicated, disposable fixture company (never real tenant data) so they are
 * safe to run repeatedly and in CI.
 *
 * Invariants covered:
 *   1. Every posted journal entry balances in base currency.
 *   2. post -> unpost returns the customer balance to exactly its pre-post
 *      value, including when withholding tax is involved (catches C2).
 *   3. post -> unpost -> post is idempotent.
 *   4. Exactly one journal entry exists per (sourceType, sourceNumber,
 *      sourceYearId) after a normal create->post flow.
 *
 * Run: npm run test:gl-invariants
 */
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { invoicePostingOrchestrator } from '../src/modules/invoices/services/invoice-posting-orchestrator.js';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { amountsEqualAt4 } from '../src/shared/utils/decimal-round.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-0000000000f0';
const BRANCH_ID = '00000000-0000-0000-0000-0000000000f1';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-0000000000f2';
const WAREHOUSE_ID = '00000000-0000-0000-0000-0000000000f3';
const ITEM_ID = '00000000-0000-0000-0000-0000000000f4';
const UNIT_ID = '00000000-0000-0000-0000-0000000000f5';
const CUSTOMER_ID = '00000000-0000-0000-0000-0000000000f6';

const failures: string[] = [];

function check(cond: boolean, msg: string) {
  if (!cond) {
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

function assertClose(a: number, b: number, msg: string, eps = 0.0001) {
  check(Math.abs(a - b) <= eps, `${msg} (expected ${b}, got ${a})`);
}

async function seedFixtures() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { isActive: true },
    create: { id: COMPANY_ID, arabicName: 'GL Invariants Fixture Co', isActive: true },
  });

  await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: { deletedAt: null },
    create: { id: BRANCH_ID, companyId: COMPANY_ID, arabicName: 'Main', legacyBranchCode: '01' },
  });

  const year = new Date().getUTCFullYear();
  await prisma.fiscalYear.upsert({
    where: { companyId_legacyYearId: { companyId: COMPANY_ID, legacyYearId: String(year) } },
    update: { status: 'Open' },
    create: {
      id: FISCAL_YEAR_ID,
      companyId: COMPANY_ID,
      legacyYearId: String(year),
      arabicName: `FY ${year}`,
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year, 11, 31)),
      status: 'Open',
    },
  });

  for (const [name, value] of Object.entries({
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
    CreditWarningOnly: 'T',
  })) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  const accountSpecs = [
    { code: 'GLI-1300', arabicName: 'Inventory', type: 'asset' },
    { code: 'GLI-1200', arabicName: 'AR', type: 'asset' },
    { code: 'GLI-4100', arabicName: 'Sales', type: 'revenue' },
    { code: 'GLI-5100', arabicName: 'COGS', type: 'expense' },
    { code: 'GLI-2300', arabicName: 'VAT Output', type: 'liability' },
    { code: 'GLI-1500', arabicName: 'WHT Receivable', type: 'asset' },
  ];
  for (const a of accountSpecs) {
    const existing = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: a.code } });
    if (!existing) {
      await prisma.account.create({
        data: { companyId: COMPANY_ID, code: a.code, arabicName: a.arabicName, accountType: a.type, isActive: true },
      });
    }
  }

  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      accountDefinitions: {
        inventoryAccount: 'GLI-1300',
        arAccount: 'GLI-1200',
        salesRevenueAccount: 'GLI-4100',
        cogsAccount: 'GLI-5100',
        vatOutputAccount: 'GLI-2300',
        whtReceivableAccount: 'GLI-1500',
      },
      allowNegativeBalance: false,
    },
    create: {
      companyId: COMPANY_ID,
      accountDefinitions: {
        inventoryAccount: 'GLI-1300',
        arAccount: 'GLI-1200',
        salesRevenueAccount: 'GLI-4100',
        cogsAccount: 'GLI-5100',
        vatOutputAccount: 'GLI-2300',
        whtReceivableAccount: 'GLI-1500',
      },
      allowNegativeBalance: false,
    },
  });

  const ar = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: 'GLI-1200' } });
  const inv = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: 'GLI-1300' } });

  await prisma.customer.upsert({
    where: { id: CUSTOMER_ID },
    update: { mainAccountId: ar!.id, creditLimit: 1_000_000, balance: 0 },
    create: {
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      arabicName: 'GL Invariants Customer',
      mainAccountId: ar!.id,
      creditLimit: 1_000_000,
      balance: 0,
    },
  });

  await prisma.warehouse.upsert({
    where: { id: WAREHOUSE_ID },
    update: { isActive: true },
    create: { id: WAREHOUSE_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, arabicName: 'Main WH', code: 'GLI-WH', isActive: true },
  });

  await prisma.unit.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: 'GLI-PCS' } },
    update: {},
    create: { id: UNIT_ID, companyId: COMPANY_ID, code: 'GLI-PCS', arabicName: 'Piece' },
  });

  await prisma.item.upsert({
    where: { id: ITEM_ID },
    update: { mainAccountId: inv!.id },
    create: { id: ITEM_ID, companyId: COMPANY_ID, serial: 'GLI-ITEM', arabicName: 'GL Invariants Item', mainAccountId: inv!.id },
  });

  await prisma.itemUnit.upsert({
    where: { itemId_unitId: { itemId: ITEM_ID, unitId: UNIT_ID } },
    update: {},
    create: { itemId: ITEM_ID, unitId: UNIT_ID, conversionFactor: 1, isBaseUnit: true },
  });

  // Give the item stock via a direct opening cost, without depending on a
  // separate purchase-invoice fixture, so a SALE has cost to relieve.
  await prisma.itemCostHistory.deleteMany({ where: { companyId: COMPANY_ID, itemId: ITEM_ID } });
  await prisma.itemCostHistory.create({
    data: {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      itemId: ITEM_ID,
      serial: 1,
      cost: 100,
      effectiveAt: new Date(Date.UTC(year, 0, 1)),
      documentDate: new Date(Date.UTC(year, 0, 1)),
      sourceType: 'OPEN',
      sourceNumber: 'OPEN-1',
      sourceYearId: String(year),
    },
  });
  const qty = await prisma.itemQuantity.findFirst({ where: { itemId: ITEM_ID, warehouseId: WAREHOUSE_ID, locationId: null } });
  if (qty) {
    await prisma.itemQuantity.update({ where: { id: qty.id }, data: { quantity: 1000 } });
  } else {
    await prisma.itemQuantity.create({ data: { itemId: ITEM_ID, warehouseId: WAREHOUSE_ID, quantity: 1000 } });
  }

  await prisma.customer.update({ where: { id: CUSTOMER_ID }, data: { balance: 0 } });
}

async function cleanupInvoice(invoiceNumber: string) {
  const stale = await prisma.invoice.findMany({
    where: { companyId: COMPANY_ID, invoiceNumber },
    select: { id: true, journalEntryId: true, costJournalEntryId: true },
  });
  const ids = stale.map((s) => s.id);

  // Phase 1 (C11) fix: unpost now clears invoice.journalEntryId/costJournalEntryId
  // (there's no single "active" JE once reversed), so the historical
  // original/reversal/re-post chain must be found by source triple instead
  // of by those two columns, or prior runs' reversal rows leak forever.
  const jeIdsFromInvoice = stale
    .flatMap((s) => [s.journalEntryId, s.costJournalEntryId])
    .filter((x): x is string => !!x);
  const jesBySource = await prisma.journalEntry.findMany({
    where: {
      companyId: COMPANY_ID,
      OR: [
        { sourceNumber: invoiceNumber },
        { sourceNumber: invoiceNumber, sourceType: { endsWith: '-COGS' } },
      ],
    },
    select: { id: true },
  });
  const jeIds = [...new Set([...jeIdsFromInvoice, ...jesBySource.map((j) => j.id)])];

  if (ids.length > 0) {
    await prisma.paymentAllocation.deleteMany({ where: { invoiceId: { in: ids } } });
    await prisma.cashTransaction.deleteMany({ where: { invoiceId: { in: ids } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
    await prisma.invoice.deleteMany({ where: { id: { in: ids } } });
  }
  if (jeIds.length > 0) {
    // Reversal rows point back at the original via reversalOfJournalEntryId
    // (unique FK) — null it out first so neither delete order can violate it.
    await prisma.journalEntry.updateMany({
      where: { reversalOfJournalEntryId: { in: jeIds } },
      data: { reversalOfJournalEntryId: null },
    });
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: jeIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: jeIds } } });
  }
}

async function assertBalancedAt4(journalEntryId: string | null | undefined, label: string) {
  if (!journalEntryId) {
    check(false, `${label}: journal entry id present`);
    return;
  }
  const entry = await prisma.journalEntry.findUnique({ where: { id: journalEntryId }, include: { lines: true } });
  check(!!entry, `${label}: journal entry exists`);
  if (!entry) return;
  const totals = journalPostingService.computeBaseTotals(
    entry.lines.map((l) => ({ debit: Number(l.debit), credit: Number(l.credit), exchangeRate: Number(l.exchangeRate) }))
  );
  check(amountsEqualAt4(totals.debitBase, totals.creditBase), `${label}: balanced (${totals.debitBase} vs ${totals.creditBase})`);
}

async function runBasicSuite() {
  console.log('[A] Basic SALE invoice (no WHT) — balanced entries + post/unpost/post round trip');
  await cleanupInvoice('GLI-SI-BASIC-001');
  const fiscalYear = await prisma.fiscalYear.findFirst({ where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID } });
  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: fiscalYear!.id,
    userId: 'gl-invariants-test',
  });

  const si = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear!.id, {
    invoiceKind: 'SALE',
    invoiceNumber: 'GLI-SI-BASIC-001',
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [
      { itemId: ITEM_ID, unitId: UNIT_ID, quantity: 5, baseQuantity: 5, price: 200, taxPercent: 14, taxAmount: 140, lineOrder: 1 },
    ],
  });
  const balanceBeforePost = Number((await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } }))!.balance);
  assertClose(balanceBeforePost, 0, 'Customer balance before post');

  const posted = await invoicePostingOrchestrator.post(ctx, si!.id);
  await assertBalancedAt4(posted.invoice.journalEntryId, 'Revenue JE');
  await assertBalancedAt4(posted.invoice.costJournalEntryId, 'COGS JE');

  const balanceAfterPost = Number((await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } }))!.balance);
  assertClose(balanceAfterPost, 1140, 'Customer balance after post'); // 5*200 + 140 tax

  console.log('\n[B] post -> unpost restores the exact pre-post balance');
  await invoicePostingOrchestrator.unpost(ctx, si!.id);
  const balanceAfterUnpost = Number((await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } }))!.balance);
  assertClose(balanceAfterUnpost, balanceBeforePost, 'Customer balance after unpost equals pre-post balance');

  console.log('\n[C] post -> unpost -> post is idempotent');
  const reposted = await invoicePostingOrchestrator.post(ctx, si!.id);
  const balanceAfterRepost = Number((await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } }))!.balance);
  assertClose(balanceAfterRepost, balanceAfterPost, 'Customer balance after re-post equals first post');
  await assertBalancedAt4(reposted.invoice.journalEntryId, 'Revenue JE (re-post)');

  console.log('\n[D] At most one *active* (activeSourceKey-holding) journal entry per source document');
  // Phase 1 (C11) fix: unpost no longer flag-flips the original JE back to
  // "unposted" — it stays posted forever and is neutralized by a dated
  // contra entry. So after post -> unpost -> post there are legitimately
  // THREE posted rows for this source (original, its reversal, the
  // re-post) — that is correct, immutable-ledger behaviour, not a bug.
  // The real invariant is: at most one of them holds the activeSourceKey
  // (enforced by both the DB unique index and app logic).
  const activeJeCount = await prisma.journalEntry.count({
    where: {
      companyId: COMPANY_ID,
      sourceType: 'SI',
      sourceNumber: 'GLI-SI-BASIC-001',
      deletedAt: null,
      activeSourceKey: { not: null },
    },
  });
  check(
    activeJeCount === 1,
    `Exactly one JE holds the activeSourceKey for source SI/GLI-SI-BASIC-001 (found ${activeJeCount})`
  );
  const totalPostedJeCount = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, sourceType: 'SI', sourceNumber: 'GLI-SI-BASIC-001', deletedAt: null, isPosted: true },
  });
  check(
    totalPostedJeCount === 3,
    `Original + reversal + re-post all remain posted forever for source SI/GLI-SI-BASIC-001 (found ${totalPostedJeCount})`
  );
  const reversalRow = await prisma.journalEntry.findFirst({
    where: { reversalOfJournalEntryId: posted.invoice.journalEntryId! },
  });
  check(!!reversalRow, 'The original post has a linked contra reversal entry (reversalOfJournalEntryId)');

  // Restore the fixture customer to a clean (zero) balance for the next suite.
  await invoicePostingOrchestrator.unpost(ctx, si!.id);
}

async function runWhtSuite() {
  console.log('\n[E] SALE invoice carrying withholding tax — balanced entries + post/unpost round trip');
  await cleanupInvoice('GLI-SI-WHT-001');
  const fiscalYear = await prisma.fiscalYear.findFirst({ where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID } });
  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: fiscalYear!.id,
    userId: 'gl-invariants-test',
  });

  const si = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear!.id, {
    invoiceKind: 'SALE',
    invoiceNumber: 'GLI-SI-WHT-001',
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    withholdingTaxAmount: 30,
    lines: [
      { itemId: ITEM_ID, unitId: UNIT_ID, quantity: 10, baseQuantity: 10, price: 200, taxPercent: 14, taxAmount: 280, lineOrder: 1 },
    ],
  });
  const balanceBeforePost = Number((await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } }))!.balance);
  assertClose(balanceBeforePost, 0, 'Customer balance before post (WHT invoice)');

  let posted: Awaited<ReturnType<typeof invoicePostingOrchestrator.post>> | undefined;
  try {
    posted = await invoicePostingOrchestrator.post(ctx, si!.id);
  } catch (e) {
    check(
      false,
      'SALE invoice with WHT posts successfully — CURRENTLY BROKEN: withholding tax is subtracted twice ' +
        "(once inside invoiceM5Service.create's netAmount, again in the orchestrator's arDebit/apDelta), " +
        'so the journal entry is permanently unbalanced whenever withholdingTaxAmount > 0. ' +
        `Fix scheduled at Phase 3 item 17 (computePartyDelta). Underlying error: ${(e as Error).message}`
    );
  }
  if (!posted) return; // remaining WHT-dependent assertions require a successful post

  await assertBalancedAt4(posted.invoice.journalEntryId, 'Revenue JE (with WHT)');
  await assertBalancedAt4(posted.invoice.costJournalEntryId, 'COGS JE (with WHT)');

  const balanceAfterPost = Number((await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } }))!.balance);
  assertClose(balanceAfterPost, 2250, 'Customer balance after post (net of WHT)'); // 2000 + 280 - 30

  console.log('\n[F] post -> unpost restores the exact pre-post balance (catches C2 — WHT asymmetry)');
  await invoicePostingOrchestrator.unpost(ctx, si!.id);
  const balanceAfterUnpost = Number((await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } }))!.balance);
  assertClose(balanceAfterUnpost, balanceBeforePost, 'Customer balance after unpost equals pre-post balance (WHT invoice)');
}

async function main() {
  console.log('Phase 0 — GL invariants suite — start\n');
  await seedFixtures();
  await runBasicSuite();
  await runWhtSuite();

  console.log('\n' + '='.repeat(60));
  if (failures.length > 0) {
    console.error(`Phase 0 — GL invariants suite — FAILED (${failures.length} failure(s)):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('Phase 0 — GL invariants suite — ALL PASSED');
  }
}

main()
  .catch((e) => {
    console.error('Phase 0 — GL invariants suite — CRASHED');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
