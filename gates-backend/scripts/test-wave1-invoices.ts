/**
 * Wave 1 — M5 invoice posting integration test.
 * Run: npm run test:wave1-invoices
 */
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { invoicePostingOrchestrator } from '../src/modules/invoices/services/invoice-posting-orchestrator.js';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { invoiceSettlementService } from '../src/modules/invoices/services/invoice-settlement.service.js';
import { itemCostService } from '../src/modules/inventory/services/item-cost.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { AppError } from '../src/shared/middleware/error-handler.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const ITEM_ID = '00000000-0000-0000-0000-000000000040';
const UNIT_ID = '00000000-0000-0000-0000-000000000041';
const SUPPLIER_ID = '00000000-0000-0000-0000-000000000050';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const SAFE_ID = '00000000-0000-0000-0000-000000000070';

const TAX_PCT = 14;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertClose(a: number, b: number, msg: string, eps = 0.02) {
  if (Math.abs(a - b) > eps) {
    throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
  }
}

async function warehouseQty(itemId: string, warehouseId: string): Promise<number> {
  const row = await prisma.itemQuantity.findFirst({
    where: { itemId, warehouseId, locationId: null },
  });
  return row ? Number(row.quantity) : 0;
}

async function assertJournalPostedBalanced(journalEntryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { lines: true },
  });
  assert(!!entry, 'Journal entry exists');
  assert(entry!.isPosted === true, 'Journal entry is posted');
  assert(entry!.postingStatus === 'Post', 'Journal postingStatus Post');
  const totals = journalPostingService.computeBaseTotals(
    entry!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(totals.debitBase, totals.creditBase, 'Journal balanced at 4dp');
}

async function seedM5Fixtures() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { isActive: true },
    create: {
      id: COMPANY_ID,
      arabicName: 'Wave1 Test Co',
      englishName: 'Wave1 Test Co',
      isActive: true,
    },
  });

  await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: { deletedAt: null },
    create: {
      id: BRANCH_ID,
      companyId: COMPANY_ID,
      arabicName: 'Main',
      legacyBranchCode: '01',
    },
  });

  const year = new Date().getUTCFullYear();
  await prisma.fiscalYear.upsert({
    where: {
      companyId_legacyYearId: { companyId: COMPANY_ID, legacyYearId: String(year) },
    },
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

  const glSettings: Record<string, string> = {
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
    CreditWarningOnly: 'F',
    // ApprovalEnforceCreditLimit defaults to true (approval-workflow.service.ts),
    // which would route the breach-test invoice into the "needs approval"
    // workflow instead of throwing the plain credit-limit error this test
    // asserts on. Keep the fixture on the direct-exception path.
    ApprovalEnforceCreditLimit: 'F',
  };
  for (const [name, value] of Object.entries(glSettings)) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  const accountSpecs = [
    { code: '1300', arabicName: 'Inventory', type: 'asset' },
    { code: '1200', arabicName: 'AR', type: 'asset' },
    { code: '2100', arabicName: 'AP', type: 'liability' },
    { code: '4100', arabicName: 'Sales', type: 'revenue' },
    { code: '5100', arabicName: 'COGS', type: 'expense' },
    { code: '2200', arabicName: 'VAT Input', type: 'asset' },
    { code: '2300', arabicName: 'VAT Output', type: 'liability' },
  ];

  for (const a of accountSpecs) {
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

  // Merge into whatever accountDefinitions other shared-fixture scripts already set
  // instead of clobbering them (this company row is reused across all wave*.ts scripts).
  const existingSettings0 = await prisma.companySettings.findUnique({ where: { companyId: COMPANY_ID } });
  const existingDefs0 = (existingSettings0?.accountDefinitions as Record<string, string>) ?? {};
  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      accountDefinitions: {
        ...existingDefs0,
        inventoryAccount: '1300',
        salesRevenueAccount: '4100',
        cogsAccount: '5100',
        vatInputAccount: '2200',
        vatOutputAccount: '2300',
      },
      allowNegativeBalance: false,
    },
    create: {
      companyId: COMPANY_ID,
      accountDefinitions: {
        inventoryAccount: '1300',
        salesRevenueAccount: '4100',
        cogsAccount: '5100',
        vatInputAccount: '2200',
        vatOutputAccount: '2300',
      },
      allowNegativeBalance: false,
    },
  });

  const ap = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '2100' },
  });
  const ar = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1200' },
  });
  const inv = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1300' },
  });
  assert(!!ap && !!ar && !!inv, 'Core accounts seeded');

  await prisma.supplier.upsert({
    where: { id: SUPPLIER_ID },
    update: { mainAccountId: ap!.id, balance: 0 },
    create: {
      id: SUPPLIER_ID,
      companyId: COMPANY_ID,
      arabicName: 'Test Supplier',
      mainAccountId: ap!.id,
      balance: 0,
    },
  });

  await prisma.customer.upsert({
    where: { id: CUSTOMER_ID },
    update: {
      mainAccountId: ar!.id,
      creditLimit: 1000,
      balance: 0,
    },
    create: {
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      arabicName: 'Test Customer',
      mainAccountId: ar!.id,
      creditLimit: 1000,
      balance: 0,
    },
  });

  await prisma.warehouse.upsert({
    where: { id: WAREHOUSE_ID },
    update: { isActive: true },
    create: {
      id: WAREHOUSE_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      arabicName: 'Main WH',
      code: 'WH01',
      isActive: true,
    },
  });

  await prisma.unit.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: 'PCS' } },
    update: {},
    create: {
      id: UNIT_ID,
      companyId: COMPANY_ID,
      code: 'PCS',
      arabicName: 'Piece',
    },
  });

  await prisma.item.upsert({
    where: { id: ITEM_ID },
    update: { mainAccountId: inv!.id },
    create: {
      id: ITEM_ID,
      companyId: COMPANY_ID,
      serial: 'W1-ITEM',
      arabicName: 'Test Item',
      mainAccountId: inv!.id,
    },
  });

  await prisma.itemUnit.upsert({
    where: { itemId_unitId: { itemId: ITEM_ID, unitId: UNIT_ID } },
    update: {},
    create: {
      itemId: ITEM_ID,
      unitId: UNIT_ID,
      conversionFactor: 1,
      isBaseUnit: true,
    },
  });

  // Idempotency: drop documents and stock history from earlier runs, otherwise the
  // moving-average assertions inherit quantities from leftover inventory movements.
  const staleInvoices = await prisma.invoice.findMany({
    where: {
      companyId: COMPANY_ID,
      invoiceNumber: {
        in: ['PI-W1-001', 'SI-W1-001', 'SI-W1-BREACH', 'SI-W1-DRAFT', 'SR-W1-001', 'PR-W1-001'],
      },
    },
    select: { id: true, journalEntryId: true, costJournalEntryId: true },
  });
  const staleIds = staleInvoices.map((i) => i.id);
  if (staleIds.length > 0) {
    const staleJournalIds = staleInvoices
      .flatMap((i) => [i.journalEntryId, i.costJournalEntryId])
      .filter((id): id is string => !!id);

    // PaymentAllocation.cashTransaction/.invoice are now Restrict (Phase 1 —
    // H14), so allocations must be cleared before their cash transactions/
    // invoices can be deleted.
    await prisma.paymentAllocation.deleteMany({ where: { invoiceId: { in: staleIds } } });
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

  await prisma.inventoryMovement.deleteMany({
    where: { companyId: COMPANY_ID, itemId: ITEM_ID },
  });

  const qty = await prisma.itemQuantity.findFirst({
    where: { itemId: ITEM_ID, warehouseId: WAREHOUSE_ID, locationId: null },
  });
  if (qty) {
    await prisma.itemQuantity.update({
      where: { id: qty.id },
      data: { quantity: 0 },
    });
  }

  await prisma.customer.update({
    where: { id: CUSTOMER_ID },
    data: { balance: 0 },
  });
  await prisma.supplier.update({
    where: { id: SUPPLIER_ID },
    data: { balance: 0 },
  });

  // Settlement fixtures: a safe with a GL account plus the cash account definition.
  const cashGl = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1100' },
  });
  const cashAccountId =
    cashGl?.id ??
    (
      await prisma.account.create({
        data: {
          companyId: COMPANY_ID,
          code: '1100',
          arabicName: 'Cash',
          accountType: 'asset',
          isActive: true,
        },
      })
    ).id;

  const settings = await prisma.companySettings.findUnique({
    where: { companyId: COMPANY_ID },
  });
  await prisma.companySettings.update({
    where: { companyId: COMPANY_ID },
    data: {
      accountDefinitions: {
        ...((settings?.accountDefinitions as Record<string, string>) ?? {}),
        cashAccount: '1100',
        arAccount: '1200',
        apAccount: '2100',
      },
    },
  });

  await prisma.safe.upsert({
    where: { id: SAFE_ID },
    update: { glAccountId: cashAccountId, balance: 0 },
    create: {
      id: SAFE_ID,
      companyId: COMPANY_ID,
      code: 'SAFE-W1',
      arabicName: 'Main Safe',
      currencyCode: 'EGP',
      glAccountId: cashAccountId,
      balance: 0,
    },
  });

  // Same Restrict-FK ordering as above: any allocation left pointing at a
  // cash transaction in this safe (e.g. from an interrupted prior run) must
  // be cleared before the cash transactions themselves can be deleted.
  const staleSafeCashTx = await prisma.cashTransaction.findMany({
    where: { companyId: COMPANY_ID, safeId: SAFE_ID },
    select: { id: true },
  });
  if (staleSafeCashTx.length > 0) {
    await prisma.paymentAllocation.deleteMany({
      where: { cashTransactionId: { in: staleSafeCashTx.map((c) => c.id) } },
    });
  }
  await prisma.cashTransaction.deleteMany({
    where: { companyId: COMPANY_ID, safeId: SAFE_ID },
  });

  await prisma.itemCostHistory.deleteMany({
    where: { companyId: COMPANY_ID, itemId: ITEM_ID },
  });
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

async function main() {
  console.log('Wave1 invoice integration test — start');
  await seedM5Fixtures();

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fiscalYear, 'Fiscal year');

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: fiscalYear!.id,
    userId: 'wave1-test',
  });

  const pi = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear!.id, {
    invoiceKind: 'PURCHASE',
    invoiceNumber: 'PI-W1-001',
    date: new Date(),
    currencyCode: 'EGP',
    supplierId: SUPPLIER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [lineWithTax(10, 100, 1)],
  });
  assert(!!pi, 'PI created');

  const piPost = await invoicePostingOrchestrator.post(ctx, pi!.id);
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), 10, 'PI warehouse qty');
  const avgCost = await itemCostService.getCostAsOf(
    COMPANY_ID,
    ITEM_ID,
    pi!.date
  );
  assertClose(avgCost, 100, 'Moving average cost after PI');
  assert(!!piPost.invoice.journalEntryId, 'PI journal linked');
  await assertJournalPostedBalanced(piPost.invoice.journalEntryId!);

  const si = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear!.id, {
    invoiceKind: 'SALE',
    invoiceNumber: 'SI-W1-001',
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [lineWithTax(4, 150, 1)],
  });

  const siPost = await invoicePostingOrchestrator.post(ctx, si!.id);
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), 6, 'SI warehouse qty');

  const customer = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assertClose(Number(customer!.balance), 684, 'Customer balance after SI');

  assert(!!siPost.invoice.journalEntryId, 'Revenue JE linked');
  assert(!!siPost.invoice.costJournalEntryId, 'COGS JE linked');
  await assertJournalPostedBalanced(siPost.invoice.journalEntryId!);
  await assertJournalPostedBalanced(siPost.invoice.costJournalEntryId!);

  const costJe = await prisma.journalEntry.findUnique({
    where: { id: siPost.invoice.costJournalEntryId! },
    include: { lines: true },
  });
  const cogsDebit = costJe!.lines.reduce((s, l) => s + Number(l.debit), 0);
  assertClose(cogsDebit, 400, 'COGS amount 4×100');

  const siLine = await prisma.invoiceLine.findFirst({ where: { invoiceId: si!.id } });
  assertClose(
    Number(siLine!.unitCostAtIssue ?? 0),
    100,
    'C5: unitCostAtIssue captured on SALE line at post time'
  );

  const sr = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear!.id, {
    invoiceKind: 'SALE_RETURN',
    invoiceNumber: 'SR-W1-001',
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [lineWithTax(2, 150, 1)],
  });
  const srPost = await invoicePostingOrchestrator.post(ctx, sr!.id);
  assert(!!srPost.invoice.costJournalEntryId, 'SR COGS reversal JE linked');
  await assertJournalPostedBalanced(srPost.invoice.costJournalEntryId!);

  // C1 regression: SR line price is 150 (selling price) while the item's
  // moving-average cost is 100 (from the PI above). Before the fix, posting
  // this return fed 150 into applyMovingAverageInTx and permanently
  // inflated the average. Assert the average is untouched by the return.
  const avgCostAfterSr = await itemCostService.getCostAsOf(
    COMPANY_ID,
    ITEM_ID,
    sr!.date
  );
  assertClose(avgCostAfterSr, 100, 'C1 fix: average cost unchanged by SALE_RETURN (not re-averaged at selling price)');

  const srCostJe = await prisma.journalEntry.findUnique({
    where: { id: srPost.invoice.costJournalEntryId! },
    include: { lines: true },
  });
  const srCogsMagnitude = srCostJe!.lines.reduce(
    (s, l) => s + Math.abs(Number(l.credit)),
    0
  );
  assertClose(srCogsMagnitude, 200, 'C5: SR COGS reversed at cost (2×100), not at selling price (2×150=300)');

  const pr = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear!.id, {
    invoiceKind: 'PURCHASE_RETURN',
    invoiceNumber: 'PR-W1-001',
    date: new Date(),
    currencyCode: 'EGP',
    supplierId: SUPPLIER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [lineWithTax(1, 100, 1)],
  });
  const prPost = await invoicePostingOrchestrator.post(ctx, pr!.id);
  assert(!!prPost.invoice.costJournalEntryId, 'PR COGS JE linked');
  await assertJournalPostedBalanced(prPost.invoice.costJournalEntryId!);
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), 7, 'Qty after SR/PR');

  const breach = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear!.id, {
    invoiceKind: 'SALE',
    invoiceNumber: 'SI-W1-BREACH',
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    // Qty must fit on-hand (7 after SR/PR) because draft create now
    // enforces AllowMinusQty; credit is still the post-time blocker.
    lines: [lineWithTax(7, 200, 1)],
  });

  let creditBlocked = false;
  try {
    await invoicePostingOrchestrator.post(ctx, breach!.id);
  } catch (e) {
    creditBlocked =
      e instanceof Error && e.message.toLowerCase().includes('credit');
  }
  assert(creditBlocked, 'Credit limit blocks excessive SI');

  // ── M5 bridge: settlement ──────────────────────────────────────────────────
  const siNet = Number((await prisma.invoice.findUnique({ where: { id: si!.id } }))!.netAmount);
  const firstSettlement = await invoiceSettlementService.settle(ctx, si!.id, {
    amount: siNet / 2,
    date: new Date(),
    safeId: SAFE_ID,
  });
  assertClose(firstSettlement.paidAmount, siNet / 2, 'Half settlement recorded');
  assertClose(firstSettlement.remainingAmount, siNet / 2, 'Remaining after half settlement');

  const safeAfterSettlement = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
  assertClose(Number(safeAfterSettlement!.balance), siNet / 2, 'Safe credited by settlement');

  let overSettleBlocked = false;
  try {
    await invoiceSettlementService.settle(ctx, si!.id, {
      amount: siNet,
      safeId: SAFE_ID,
    });
  } catch (e) {
    overSettleBlocked = e instanceof Error && /outstanding/i.test(e.message);
  }
  assert(overSettleBlocked, 'Settlement above outstanding balance rejected');

  const afterReverse = await invoiceSettlementService.reverse(
    ctx,
    si!.id,
    firstSettlement.cashTransactionId
  );
  assertClose(afterReverse.paidAmount, 0, 'Paid amount cleared after reversal');
  assertClose(afterReverse.remainingAmount, siNet, 'Remaining restored after reversal');

  // ── M5 bridge: update / cancel / delete guards ─────────────────────────────
  let editPostedBlocked = false;
  try {
    await invoiceM5Service.update(COMPANY_ID, si!.id, { description: 'nope' });
  } catch (e) {
    editPostedBlocked = e instanceof Error && /unpost/i.test(e.message);
  }
  assert(editPostedBlocked, 'Editing a posted invoice rejected');

  const draft = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear!.id, {
    invoiceKind: 'SALE',
    invoiceNumber: 'SI-W1-DRAFT',
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [lineWithTax(2, 50, 1)],
  });

  const updated = await invoiceM5Service.update(COMPANY_ID, draft!.id, {
    lines: [lineWithTax(3, 60, 1)],
    description: 'updated draft',
  });
  assertClose(Number(updated!.totalAmount), 180, 'Draft totals recomputed on update');
  assert(updated!.lines.length === 1, 'Draft lines replaced on update');

  const cancelled = await invoiceM5Service.cancel(COMPANY_ID, draft!.id);
  assert(cancelled.isCancelled === true, 'Draft cancelled');

  let editCancelledBlocked = false;
  try {
    await invoiceM5Service.update(COMPANY_ID, draft!.id, { description: 'nope' });
  } catch (e) {
    editCancelledBlocked = e instanceof Error && /cancelled/i.test(e.message);
  }
  assert(editCancelledBlocked, 'Editing a cancelled invoice rejected');

  await invoiceM5Service.remove(COMPANY_ID, draft!.id);
  const goneDraft = await prisma.invoice.findUnique({ where: { id: draft!.id } });
  assert(goneDraft === null, 'Cancelled draft deleted');

  let deletePostedBlocked = false;
  try {
    await invoiceM5Service.remove(COMPANY_ID, si!.id);
  } catch (e) {
    deletePostedBlocked = e instanceof Error && /posted/i.test(e.message);
  }
  assert(deletePostedBlocked, 'Deleting a posted invoice rejected');

  await invoicePostingOrchestrator.unpost(ctx, pr!.id);
  await invoicePostingOrchestrator.unpost(ctx, sr!.id);

  await invoicePostingOrchestrator.unpost(ctx, si!.id);
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), 10, 'Qty after SI unpost');
  const custAfterUnSi = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assertClose(Number(custAfterUnSi!.balance), 0, 'Customer balance after SI unpost');

  // C11: unpost no longer flag-flips the original revenue JE back to
  // "unposted" — it stays posted forever (immutable fact) and gets
  // neutralized by a dated contra entry linked via reversalOfJournalEntryId.
  const revJe = await prisma.journalEntry.findUnique({
    where: { id: siPost.invoice.journalEntryId! },
  });
  assert(revJe!.isPosted === true, 'Original revenue JE remains posted (immutable)');
  assert(revJe!.activeSourceKey === null, 'Original revenue JE released its activeSourceKey on reversal');
  const revJeReversal = await prisma.journalEntry.findFirst({
    where: { reversalOfJournalEntryId: revJe!.id },
  });
  assert(!!revJeReversal, 'Revenue JE has a contra reversal entry');
  assert(revJeReversal!.isPosted === true, 'Reversal entry is posted');

  let doubleUnpostFailed = false;
  try {
    await invoicePostingOrchestrator.unpost(ctx, si!.id);
  } catch (e) {
    doubleUnpostFailed = e instanceof AppError || e instanceof Error;
  }
  assert(doubleUnpostFailed, 'Double unpost rejected');

  await invoicePostingOrchestrator.unpost(ctx, pi!.id);
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), 0, 'Qty after PI unpost');
  const costCount = await prisma.itemCostHistory.count({
    where: { companyId: COMPANY_ID, itemId: ITEM_ID },
  });
  assert(costCount === 0, 'Cost history cleared after PI unpost');
  const costAfter = await itemCostService.getCostAsOf(
    COMPANY_ID,
    ITEM_ID,
    new Date()
  );
  assertClose(costAfter, 0, 'Cost restored to 0 after PI unpost');

  console.log('Wave1 invoice integration test — PASSED');
}

main()
  .catch((e) => {
    console.error('Wave1 invoice integration test — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
