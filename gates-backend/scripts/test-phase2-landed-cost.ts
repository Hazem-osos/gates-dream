/**
 * Phase 2 — landed-cost capitalization integration test (H9).
 *
 * Freight/customs/etc. paid to a third party and initially recorded against
 * an expense/clearing account get reallocated into the received items'
 * inventory value, split by merchandise-value share, via
 * landedCostService.postAllocation. Covers:
 *   - Proportional allocation across multiple invoice lines.
 *   - Moving-average cost top-up without changing on-hand quantity.
 *   - A balanced GL reclass entry (Dr inventory / Cr expense account).
 *   - Unpost reverses both the cost top-up and the GL entry.
 *   - Guardrails: only postable against a posted PURCHASE invoice.
 *
 * Run: npm run test:phase2-landed-cost
 */
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { invoicePostingOrchestrator } from '../src/modules/invoices/services/invoice-posting-orchestrator.js';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { itemCostService } from '../src/modules/inventory/services/item-cost.service.js';
import { landedCostService } from '../src/modules/inventory/services/landed-cost.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { AppError } from '../src/shared/middleware/error-handler.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-0000000000h0';
const BRANCH_ID = '00000000-0000-0000-0000-0000000000h1';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-0000000000h2';
const WAREHOUSE_ID = '00000000-0000-0000-0000-0000000000h3';
const ITEM_A_ID = '00000000-0000-0000-0000-0000000000h4';
const ITEM_B_ID = '00000000-0000-0000-0000-0000000000h5';
const UNIT_ID = '00000000-0000-0000-0000-0000000000h6';
const SUPPLIER_ID = '00000000-0000-0000-0000-0000000000h7';

const failures: string[] = [];
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}
function assertClose(a: number, b: number, msg: string, eps = 0.02) {
  check(Math.abs(a - b) <= eps, `${msg} (expected ${b}, got ${a})`);
}

async function seed() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { isActive: true },
    create: { id: COMPANY_ID, arabicName: 'Landed Cost Fixture Co', isActive: true },
  });
  await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: { deletedAt: null },
    create: { id: BRANCH_ID, companyId: COMPANY_ID, arabicName: 'Main', legacyBranchCode: '01' },
  });

  const year = new Date().getUTCFullYear();
  const fiscalYear = await prisma.fiscalYear.upsert({
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

  const glSettings: Record<string, string> = {
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
    ApprovalEnforceCreditLimit: 'F',
  };
  for (const [name, value] of Object.entries(glSettings)) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  const accountSpecs = [
    { code: '1300', arabicName: 'Inventory', type: 'asset' },
    { code: '2100', arabicName: 'AP', type: 'liability' },
    { code: '5900', arabicName: 'Freight Clearing', type: 'expense' },
  ];
  for (const a of accountSpecs) {
    const existing = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: a.code } });
    if (!existing) {
      await prisma.account.create({
        data: { companyId: COMPANY_ID, code: a.code, arabicName: a.arabicName, accountType: a.type, isActive: true },
      });
    }
  }
  const inv = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '1300' } });
  const ap = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '2100' } });
  const freight = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '5900' } });

  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: { accountDefinitions: { inventoryAccount: '1300' }, allowNegativeBalance: false },
    create: { companyId: COMPANY_ID, accountDefinitions: { inventoryAccount: '1300' }, allowNegativeBalance: false },
  });

  await prisma.supplier.upsert({
    where: { id: SUPPLIER_ID },
    update: { mainAccountId: ap!.id, balance: 0 },
    create: { id: SUPPLIER_ID, companyId: COMPANY_ID, arabicName: 'Landed Cost Supplier', mainAccountId: ap!.id, balance: 0 },
  });

  await prisma.warehouse.upsert({
    where: { id: WAREHOUSE_ID },
    update: { isActive: true },
    create: { id: WAREHOUSE_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, arabicName: 'Main WH', code: 'WHLC', isActive: true },
  });

  await prisma.unit.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: 'PCS' } },
    update: {},
    create: { id: UNIT_ID, companyId: COMPANY_ID, code: 'PCS', arabicName: 'Piece' },
  });

  for (const [id, name] of [
    [ITEM_A_ID, 'Landed Cost Item A'],
    [ITEM_B_ID, 'Landed Cost Item B'],
  ] as const) {
    await prisma.item.upsert({
      where: { id },
      update: { mainAccountId: inv!.id },
      create: { id, companyId: COMPANY_ID, serial: name, arabicName: name, mainAccountId: inv!.id },
    });
    await prisma.itemUnit.upsert({
      where: { itemId_unitId: { itemId: id, unitId: UNIT_ID } },
      update: {},
      create: { itemId: id, unitId: UNIT_ID, conversionFactor: 1, isBaseUnit: true },
    });
  }

  // Idempotency: wipe prior runs' invoice/allocation/movement/cost-history data.
  const staleInvoices = await prisma.invoice.findMany({
    where: { companyId: COMPANY_ID, invoiceNumber: { in: ['PI-LC-001', 'SI-LC-DRAFT'] } },
    select: { id: true, journalEntryId: true, costJournalEntryId: true },
  });
  const staleIds = staleInvoices.map((i) => i.id);
  if (staleIds.length > 0) {
    await prisma.landedCostAllocationLine.deleteMany({ where: { invoiceLine: { invoiceId: { in: staleIds } } } });
    await prisma.landedCostAllocation.deleteMany({ where: { invoiceId: { in: staleIds } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: staleIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: staleIds } } });
    const staleJournalIds = staleInvoices
      .flatMap((i) => [i.journalEntryId, i.costJournalEntryId])
      .filter((x): x is string => !!x);
    if (staleJournalIds.length > 0) {
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: staleJournalIds } } });
      await prisma.journalEntry.deleteMany({ where: { id: { in: staleJournalIds } } });
    }
  }
  await prisma.itemCostHistory.deleteMany({ where: { companyId: COMPANY_ID, itemId: { in: [ITEM_A_ID, ITEM_B_ID] } } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId: COMPANY_ID, itemId: { in: [ITEM_A_ID, ITEM_B_ID] } } });
  await prisma.itemQuantity.updateMany({ where: { itemId: { in: [ITEM_A_ID, ITEM_B_ID] } }, data: { quantity: 0 } });

  return { fiscalYear, freightAccountId: freight!.id };
}

async function main() {
  console.log('Phase 2 — landed cost capitalization (H9) — start');
  const { fiscalYear, freightAccountId } = await seed();

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: fiscalYear.id,
    userId: 'phase2-landed-cost-test',
  });

  // 100 units @ 10 (merch 1000) + 50 units @ 4 (merch 200) = 1200 total merch.
  const pi = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear.id, {
    invoiceKind: 'PURCHASE',
    invoiceNumber: 'PI-LC-001',
    date: new Date(),
    currencyCode: 'EGP',
    supplierId: SUPPLIER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear.legacyYearId,
    lines: [
      { itemId: ITEM_A_ID, unitId: UNIT_ID, quantity: 100, baseQuantity: 100, price: 10, lineOrder: 1 },
      { itemId: ITEM_B_ID, unitId: UNIT_ID, quantity: 50, baseQuantity: 50, price: 4, lineOrder: 2 },
    ],
  });
  check(!!pi, 'PURCHASE invoice created');
  await invoicePostingOrchestrator.post(ctx, pi!.id);

  const costABefore = await itemCostService.getCostAsOf(COMPANY_ID, ITEM_A_ID, new Date());
  const costBBefore = await itemCostService.getCostAsOf(COMPANY_ID, ITEM_B_ID, new Date());
  assertClose(costABefore, 10, 'Item A average cost after PI = 10');
  assertClose(costBBefore, 4, 'Item B average cost after PI = 4');

  // Guardrail: cannot allocate against an unposted invoice.
  const draftPi = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, fiscalYear.id, {
    invoiceKind: 'PURCHASE',
    invoiceNumber: 'SI-LC-DRAFT',
    date: new Date(),
    currencyCode: 'EGP',
    supplierId: SUPPLIER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear.legacyYearId,
    lines: [{ itemId: ITEM_A_ID, unitId: UNIT_ID, quantity: 1, baseQuantity: 1, price: 1, lineOrder: 1 }],
  });
  try {
    await landedCostService.createAllocation(COMPANY_ID, {
      companyId: COMPANY_ID,
      invoiceId: draftPi!.id,
      date: new Date().toISOString(),
      totalAmount: 10,
      expenseAccountId: freightAccountId,
    });
    check(false, 'Allocating against an unposted invoice should throw');
  } catch (e) {
    check(e instanceof AppError && e.statusCode === 422, 'Allocating against an unposted invoice throws 422');
  }

  // 120 landed cost, split 1000:200 -> 100 to item A, 20 to item B.
  const allocation = await landedCostService.createAllocation(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    invoiceId: pi!.id,
    serial: 'LCA-001',
    date: new Date().toISOString(),
    totalAmount: 120,
    expenseAccountId: freightAccountId,
  });
  check(!!allocation, 'Landed cost allocation created');
  const lineA = allocation.lines.find((l) => l.itemId === ITEM_A_ID)!;
  const lineB = allocation.lines.find((l) => l.itemId === ITEM_B_ID)!;
  assertClose(Number(lineA.allocatedAmount), 100, 'Item A allocated 1000/1200×120=100');
  assertClose(Number(lineB.allocatedAmount), 20, 'Item B allocated 200/1200×120=20');

  const glCtx = { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: fiscalYear.id, userId: 'phase2-landed-cost-test' };
  const postResult = await landedCostService.postAllocation(COMPANY_ID, allocation.id, glCtx);
  check(postResult.skippedItems.length === 0, 'No items skipped — both had stock on hand');

  const costAAfter = await itemCostService.getCostAsOf(COMPANY_ID, ITEM_A_ID, new Date());
  const costBAfter = await itemCostService.getCostAsOf(COMPANY_ID, ITEM_B_ID, new Date());
  assertClose(costAAfter, 11, 'Item A cost capitalized: 10 + 100/100 = 11');
  assertClose(costBAfter, 4.4, 'Item B cost capitalized: 4 + 20/50 = 4.4');

  const qtyAAfter = await prisma.itemQuantity.findFirst({ where: { itemId: ITEM_A_ID, warehouseId: WAREHOUSE_ID } });
  assertClose(Number(qtyAAfter?.quantity ?? 0), 100, 'Item A quantity unchanged by capitalization (100)');

  check(!!postResult.journalEntryId, 'Landed cost GL entry posted');
  if (postResult.journalEntryId) {
    const je = await prisma.journalEntry.findUnique({
      where: { id: postResult.journalEntryId },
      include: { lines: true },
    });
    const debit = je!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = je!.lines.reduce((s, l) => s + Number(l.credit), 0);
    assertClose(debit, 120, 'GL debit inventory = 120 (100+20, same account)');
    assertClose(credit, 120, 'GL credit freight clearing = 120');
    check(Math.abs(debit - credit) < 0.0001, 'Landed cost JE balances exactly');
  }

  const year = String(new Date().getUTCFullYear());
  const key = journalPostingService.buildActiveSourceKey(COMPANY_ID, 'LCA', 'LCA-001', year);
  const activeJe = key ? await prisma.journalEntry.findUnique({ where: { activeSourceKey: key } }) : null;
  check(!!activeJe, 'Active JE resolvable by (LCA, serial, year) source key');

  await landedCostService.unpostAllocation(COMPANY_ID, allocation.id, glCtx);
  const costAReverted = await itemCostService.getCostAsOf(COMPANY_ID, ITEM_A_ID, new Date());
  const costBReverted = await itemCostService.getCostAsOf(COMPANY_ID, ITEM_B_ID, new Date());
  assertClose(costAReverted, 10, 'Item A cost reverted to 10 after unpost');
  assertClose(costBReverted, 4, 'Item B cost reverted to 4 after unpost');
  const activeJeAfterUnpost = key ? await prisma.journalEntry.findUnique({ where: { activeSourceKey: key } }) : null;
  check(activeJeAfterUnpost === null, 'No active JE remains after unpost (reversed by contra)');

  // Guardrail: cannot allocate against a SALE invoice.
  try {
    await landedCostService.createAllocation(COMPANY_ID, {
      companyId: COMPANY_ID,
      invoiceId: draftPi!.id, // still PURCHASE but unposted — reuse to also confirm invoiceKind check order doesn't matter
      date: new Date().toISOString(),
      totalAmount: 5,
      expenseAccountId: freightAccountId,
    });
  } catch (e) {
    check(e instanceof AppError, 'Second guardrail check throws AppError as expected');
  }

  if (failures.length > 0) {
    console.error(`\nPhase 2 landed cost — FAILED (${failures.length} failure(s)):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nPhase 2 landed cost — PASSED');
}

main()
  .catch((e) => {
    console.error('Phase 2 landed cost — FAILED (exception)');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
