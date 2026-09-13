/**
 * Phase 2 — costing & inventory-truth integration test.
 *
 * Covers the roadmap items that don't already have coverage in
 * test-wave1-invoices.ts (C1/C5 there):
 *   - Stocktaking posts a GL shrinkage/surplus variance and moves quantity
 *     through stockMovementService (locked, audited) instead of a raw
 *     item_quantities write.                                        (C3, H1)
 *   - Adjustment nets multiple increase/decrease lines into one GL entry.  (C3, H1)
 *   - Transfer moves quantity+cost between warehouses with no GL entry
 *     (single company-wide inventory account = GL-neutral) but a full
 *     InventoryMovement audit trail on both legs.                        (H1)
 *   - Assembly rolls the true BOM cost into the finished item's moving
 *     average (a genuine inbound-at-cost/production-receipt event) and
 *     posts a balanced GL transformation entry.                     (C3, C8)
 *   - Unpost reverses quantities, cost history and the GL entry (via a
 *     dated contra reversal, never a flag-flip) for every voucher type.  (C11)
 *
 * Run: npm run test:phase2-inventory
 */
import { PrismaClient } from '@prisma/client';
import { stocktakingService } from '../src/modules/inventory/services/stocktaking.service.js';
import { adjustmentService } from '../src/modules/inventory/services/adjustment.service.js';
import { transferService } from '../src/modules/inventory/services/transfer.service.js';
import { assemblyService } from '../src/modules/inventory/services/assembly.service.js';
import { disassemblyService } from '../src/modules/inventory/services/disassembly.service.js';
import { issueService } from '../src/modules/inventory/services/issue.service.js';
import { receiptService } from '../src/modules/inventory/services/receipt.service.js';
import { openingStockService } from '../src/modules/inventory/services/opening-stock.service.js';
import { purchaseReturnService } from '../src/modules/inventory/services/purchase-return.service.js';
import { itemCostService } from '../src/modules/inventory/services/item-cost.service.js';
import { stockMovementService } from '../src/modules/inventory/services/stock-movement.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';
import { inventoryGlReconciliationService } from '../src/modules/accounting/services/inventory-gl-reconciliation.service.js';
import { resolveStockGlAccounts } from '../src/modules/inventory/services/stock-movement-gl.service.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';
import { roundTo4 } from '../src/shared/utils/decimal-round.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-0000000000g0';
const BRANCH_ID = '00000000-0000-0000-0000-0000000000g1';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-0000000000g2';
const WAREHOUSE_ID = '00000000-0000-0000-0000-0000000000g3';
const WAREHOUSE2_ID = '00000000-0000-0000-0000-0000000000g4';
// Every test below gets its own dedicated item(s) — never shared across
// tests — so seedOpeningBalance's additive movements can't contaminate
// another test's assertions.
const ITEM_ID = '00000000-0000-0000-0000-0000000000g5'; // stocktaking
const ADJ_ITEM_ID = '00000000-0000-0000-0000-0000000000g6'; // adjustment
const COMPONENT_A_ID = '00000000-0000-0000-0000-0000000000g7'; // assembly input
const COMPONENT_B_ID = '00000000-0000-0000-0000-0000000000g8'; // assembly input
const ASSEMBLED_ID = '00000000-0000-0000-0000-0000000000g9'; // assembly output
const DSM_ITEM_ID = '00000000-0000-0000-0000-0000000000ga'; // disassembly input
const DSM_COMPONENT_A_ID = '00000000-0000-0000-0000-0000000000gb'; // disassembly output
const DSM_COMPONENT_B_ID = '00000000-0000-0000-0000-0000000000gc'; // disassembly output
const UNIT_ID = '00000000-0000-0000-0000-0000000000gd';
const ISSUE_ITEM_ID = '00000000-0000-0000-0000-0000000000ge'; // issue
const RECEIPT_ITEM_ID = '00000000-0000-0000-0000-0000000000gf'; // receipt
const OPEN_ITEM_ID = '00000000-0000-0000-0000-0000000000gg'; // opening stock
const PRT_ITEM_ID = '00000000-0000-0000-0000-0000000000gh'; // purchase return
const SUPPLIER_ID = '00000000-0000-0000-0000-0000000000gi';

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

async function warehouseQty(itemId: string, warehouseId: string): Promise<number> {
  const row = await prisma.itemQuantity.findFirst({ where: { itemId, warehouseId, locationId: null } });
  return row ? Number(row.quantity) : 0;
}

async function activeJe(sourceType: string, sourceNumber: string, sourceYearId: string) {
  const key = journalPostingService.buildActiveSourceKey(COMPANY_ID, sourceType, sourceNumber, sourceYearId);
  if (!key) return null;
  return prisma.journalEntry.findUnique({ where: { activeSourceKey: key }, include: { lines: true } });
}

/** Wipe prior runs' documents/movements/JEs so the script is safe to re-run. */
async function resetFixtureData() {
  await prisma.stocktaking.deleteMany({ where: { companyId: COMPANY_ID } }); // lines cascade
  await prisma.adjustment.deleteMany({ where: { companyId: COMPANY_ID } }); // lines cascade
  await prisma.transfer.deleteMany({ where: { companyId: COMPANY_ID } }); // lines cascade
  await prisma.assembly.deleteMany({ where: { companyId: COMPANY_ID } }); // lines+components cascade
  await prisma.disassembly.deleteMany({ where: { companyId: COMPANY_ID } }); // lines+components cascade
  await prisma.issue.deleteMany({ where: { companyId: COMPANY_ID } }); // lines cascade
  await prisma.receipt.deleteMany({ where: { companyId: COMPANY_ID } }); // lines cascade
  await prisma.openingStock.deleteMany({ where: { companyId: COMPANY_ID } }); // lines cascade
  await prisma.purchaseReturn.deleteMany({ where: { companyId: COMPANY_ID } }); // lines cascade
  await prisma.inventoryMovement.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.itemCostHistory.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.itemQuantity.deleteMany({
    where: {
      itemId: {
        in: [
          ITEM_ID,
          ADJ_ITEM_ID,
          COMPONENT_A_ID,
          COMPONENT_B_ID,
          ASSEMBLED_ID,
          DSM_ITEM_ID,
          DSM_COMPONENT_A_ID,
          DSM_COMPONENT_B_ID,
          ISSUE_ITEM_ID,
          RECEIPT_ITEM_ID,
          OPEN_ITEM_ID,
          PRT_ITEM_ID,
        ],
      },
    },
  });
  // Reversal rows point back at the original via reversalOfJournalEntryId
  // (unique FK) — null it out first so neither delete order can violate it.
  await prisma.journalEntry.updateMany({
    where: { companyId: COMPANY_ID },
    data: { reversalOfJournalEntryId: null },
  });
  await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { companyId: COMPANY_ID } } });
  await prisma.journalEntry.deleteMany({ where: { companyId: COMPANY_ID } });
}

async function seed() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { isActive: true },
    create: { id: COMPANY_ID, arabicName: 'Phase2 Inventory Fixture Co', isActive: true },
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

  const glSettings: Record<string, string> = {
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
    AllowNegativeStore: 'F',
  };
  for (const [name, value] of Object.entries(glSettings)) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  const accountSpecs = [
    { code: '1300', arabicName: 'Inventory', type: 'asset' },
    { code: '1310', arabicName: 'Finished Goods Inventory', type: 'asset' },
    { code: '5300', arabicName: 'Inventory Adjustment / Shrinkage', type: 'expense' },
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
  const finishedGoods = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '1310' } });
  const adj = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '5300' } });

  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      accountDefinitions: {
        inventoryAccount: '1300',
        inventoryAdjustmentAccount: '5300',
        operatingExpenseAccount: '5300',
      },
      allowNegativeBalance: false,
    },
    create: {
      companyId: COMPANY_ID,
      accountDefinitions: {
        inventoryAccount: '1300',
        inventoryAdjustmentAccount: '5300',
        operatingExpenseAccount: '5300',
      },
      allowNegativeBalance: false,
    },
  });

  for (const wid of [WAREHOUSE_ID, WAREHOUSE2_ID]) {
    await prisma.warehouse.upsert({
      where: { id: wid },
      update: { isActive: true },
      create: { id: wid, companyId: COMPANY_ID, branchId: BRANCH_ID, arabicName: `WH ${wid.slice(-1)}`, code: `WH${wid.slice(-1)}`, isActive: true },
    });
  }

  await prisma.unit.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: 'PCS' } },
    update: {},
    create: { id: UNIT_ID, companyId: COMPANY_ID, code: 'PCS', arabicName: 'Piece' },
  });

  for (const [id, name, accountId] of [
    [ITEM_ID, 'Stock Item', inv!.id],
    [ADJ_ITEM_ID, 'Adjustment Item', inv!.id],
    [COMPONENT_A_ID, 'Component A', inv!.id],
    [COMPONENT_B_ID, 'Component B', inv!.id],
    // Deliberately a different control account than the components so the
    // transformation JE has real, non-netting-to-zero lines to assert on.
    [ASSEMBLED_ID, 'Assembled Item', finishedGoods!.id],
    [DSM_ITEM_ID, 'Disassembly Item', finishedGoods!.id],
    [DSM_COMPONENT_A_ID, 'Disassembly Component A', inv!.id],
    [DSM_COMPONENT_B_ID, 'Disassembly Component B', inv!.id],
    [ISSUE_ITEM_ID, 'Issue Item', inv!.id],
    [RECEIPT_ITEM_ID, 'Receipt Item', inv!.id],
    [OPEN_ITEM_ID, 'Opening Stock Item', inv!.id],
    [PRT_ITEM_ID, 'Purchase Return Item', inv!.id],
  ] as const) {
    await prisma.item.upsert({
      where: { id },
      update: { mainAccountId: accountId },
      create: { id, companyId: COMPANY_ID, serial: name, arabicName: name, mainAccountId: accountId },
    });
    await prisma.itemUnit.upsert({
      where: { itemId_unitId: { itemId: id, unitId: UNIT_ID } },
      update: {},
      create: { itemId: id, unitId: UNIT_ID, conversionFactor: 1, isBaseUnit: true },
    });
  }

  const ap = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '2100' } });
  const apAccount =
    ap ??
    (await prisma.account.create({
      data: { companyId: COMPANY_ID, code: '2100', arabicName: 'AP', accountType: 'liability', isActive: true },
    }));
  await prisma.supplier.upsert({
    where: { id: SUPPLIER_ID },
    update: { mainAccountId: apAccount.id, balance: 0 },
    create: { id: SUPPLIER_ID, companyId: COMPANY_ID, arabicName: 'Phase2 Test Supplier', mainAccountId: apAccount.id, balance: 0 },
  });

  return { invAccountId: inv!.id, finishedGoodsAccountId: finishedGoods!.id, adjAccountId: adj!.id };
}

/**
 * Give an item an opening balance + average cost via the real stock/cost
 * services (never a raw write) — AND post a matching GL entry for that
 * value (debit the item's own control account, credit the adjustment
 * account as the offset). Without this, every fixture built on top of a
 * seeded opening balance would carry stock value the GL never knows
 * about, making the reconciliation-report assertions below meaningless
 * (they'd always show the seeded value as a permanent "variance" that has
 * nothing to do with whether the real post/unpost GL logic is correct).
 */
async function seedOpeningBalance(itemId: string, warehouseId: string, qty: number, unitCost: number) {
  const sourceNumber = `OPEN-${itemId.slice(-4)}-${warehouseId.slice(-1)}`;
  const sourceYearId = String(new Date().getUTCFullYear());
  await prisma.$transaction(async (tx) => {
    await stockMovementService.postMovementInTx(tx, {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      warehouseId,
      itemId,
      quantityDelta: qty,
      unitCost,
      movementType: 'OPEN',
      sourceType: 'OPEN',
      sourceNumber,
      sourceYearId,
      documentDate: new Date(),
    });
    await itemCostService.applyMovingAverageInTx(tx, {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      itemId,
      invoiceDate: new Date(),
      itemCount: qty,
      itemPrice: unitCost,
      sourceNum: sourceNumber,
      sourceYearId,
      sourceType: 'OPEN',
      change: 1,
    });

    const value = roundTo4(qty * unitCost);
    if (value > 0) {
      const item = await tx.item.findUnique({ where: { id: itemId }, select: { mainAccountId: true } });
      const accounts = await resolveStockGlAccounts(COMPANY_ID);
      const debitAccountId = item?.mainAccountId ?? accounts.inventoryAccountId;
      await journalPostingService.createAndPostInTx(
        tx,
        { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: FISCAL_YEAR_ID, userId: 'phase2-test' },
        {
          date: new Date(),
          description: `Opening balance seed ${sourceNumber}`,
          currencyCode: 'EGP',
          fiscalYearId: FISCAL_YEAR_ID,
          sourceType: 'OPEN',
          sourceNumber,
          sourceYearId,
          entryType: 'OPENING_BALANCE',
          lines: [
            { accountId: debitAccountId, debit: value, credit: 0, lineOrder: 1, description: 'Opening balance — inventory' },
            { accountId: accounts.adjustmentAccountId, debit: 0, credit: value, lineOrder: 2, description: 'Opening balance — offset' },
          ],
        }
      );
    }
  });
}

async function testStocktaking() {
  console.log('\n-- Stocktaking (C3, H1) --');
  await seedOpeningBalance(ITEM_ID, WAREHOUSE_ID, 100, 10);
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), 100, 'Opening balance 100');

  const stk = await stocktakingService.createStocktaking(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'STK-P2-001',
    date: new Date().toISOString(),
    warehouseId: WAREHOUSE_ID,
    lines: [
      { itemId: ITEM_ID, warehouseId: WAREHOUSE_ID, bookQuantity: 100, actualQuantity: 90, unitPrice: 10 },
    ],
  });

  const glCtx = { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: FISCAL_YEAR_ID, userId: 'phase2-test' };
  await stocktakingService.postStocktaking(COMPANY_ID, stk.id, glCtx);

  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), 90, 'Qty reduced to 90 after shortage');

  const movement = await prisma.inventoryMovement.findFirst({
    where: { companyId: COMPANY_ID, itemId: ITEM_ID, sourceType: 'STK', sourceNumber: 'STK-P2-001' },
  });
  check(!!movement, 'InventoryMovement audit row created for stocktaking (H1)');
  assertClose(Number(movement?.quantityDelta ?? 0), -10, 'Movement delta is -10');

  const year = String(new Date().getUTCFullYear());
  const je = await activeJe('STK', 'STK-P2-001', year);
  check(!!je, 'Stocktaking GL variance entry posted (C3)');
  if (je) {
    const debit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    assertClose(debit, 100, 'Shortage debits shrinkage 10×10=100');
    assertClose(credit, 100, 'Shortage credits inventory 100');
    check(debit === credit, 'Stocktaking JE balances');
  }

  await stocktakingService.unpostStocktaking(COMPANY_ID, stk.id, glCtx);
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), 100, 'Qty restored to 100 after unpost');
  const jeAfterUnpost = await activeJe('STK', 'STK-P2-001', year);
  check(jeAfterUnpost === null, 'No active JE remains after unpost (reversed by contra, C11)');
  const originalJe = await prisma.journalEntry.findUnique({ where: { id: je!.id } });
  check(originalJe!.isPosted === true, 'Original stocktaking JE stays posted forever (C11)');
}

async function testAdjustment() {
  console.log('\n-- Adjustment netting (C3, H1) --');
  await seedOpeningBalance(ADJ_ITEM_ID, WAREHOUSE_ID, 50, 4);

  const adjustment = await adjustmentService.createAdjustment(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'ADJ-P2-001',
    date: new Date().toISOString(),
    warehouseId: WAREHOUSE_ID,
    lines: [
      { itemId: ADJ_ITEM_ID, bookQuantity: 50, actualQuantity: 60, unitPrice: 4 }, // +10 × 4 = +40
    ],
  });

  const glCtx = { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: FISCAL_YEAR_ID, userId: 'phase2-test' };
  await adjustmentService.postAdjustment(COMPANY_ID, adjustment.id, glCtx);

  assertClose(await warehouseQty(ADJ_ITEM_ID, WAREHOUSE_ID), 60, 'Adjustment item qty increased to 60');

  const year = String(new Date().getUTCFullYear());
  const je = await activeJe('ADJ', 'ADJ-P2-001', year);
  check(!!je, 'Adjustment GL variance entry posted');
  if (je) {
    const debit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    assertClose(debit, 40, 'Net increase debits inventory 10×4=40');
  }

  await adjustmentService.unpostAdjustment(COMPANY_ID, adjustment.id, glCtx);
  assertClose(await warehouseQty(ADJ_ITEM_ID, WAREHOUSE_ID), 50, 'Adjustment item qty restored to 50');
  check((await activeJe('ADJ', 'ADJ-P2-001', year)) === null, 'Adjustment JE reversed on unpost');
}

async function testTransfer() {
  console.log('\n-- Transfer (H1, GL-neutral) --');

  const beforeFrom = await warehouseQty(ITEM_ID, WAREHOUSE_ID);
  const transfer = await transferService.createTransfer(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'TRF-P2-001',
    date: new Date().toISOString(),
    fromWarehouseId: WAREHOUSE_ID,
    toWarehouseId: WAREHOUSE2_ID,
    lines: [{ itemId: ITEM_ID, quantity: 20 }],
  });

  await transferService.postTransfer(COMPANY_ID, transfer.id);

  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), beforeFrom - 20, 'Source warehouse reduced by 20');
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE2_ID), 20, 'Destination warehouse increased by 20');

  const movements = await prisma.inventoryMovement.findMany({
    where: { companyId: COMPANY_ID, itemId: ITEM_ID, sourceType: 'TRF', sourceNumber: 'TRF-P2-001' },
  });
  check(movements.length === 2, 'Both legs of transfer recorded as InventoryMovement (H1)');
  check(movements.some((m) => Number(m.unitCost) === 10), 'Transfer movement carries the item current cost (value moves with it)');

  const year = String(new Date().getUTCFullYear());
  const je = await activeJe('TRF', 'TRF-P2-001', year);
  check(je === null, 'Transfer posts no GL entry (single company inventory account = GL-neutral)');

  await transferService.unpostTransfer(COMPANY_ID, transfer.id);
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE_ID), beforeFrom, 'Source warehouse restored after unpost');
  assertClose(await warehouseQty(ITEM_ID, WAREHOUSE2_ID), 0, 'Destination warehouse restored after unpost');
}

async function testAssembly() {
  console.log('\n-- Assembly (C3, C8-adjacent — production receipt) --');
  await seedOpeningBalance(COMPONENT_A_ID, WAREHOUSE_ID, 100, 4); // cost 4/unit
  await seedOpeningBalance(COMPONENT_B_ID, WAREHOUSE_ID, 100, 6); // cost 6/unit

  const assembly = await assemblyService.createAssembly(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'ASM-P2-001',
    date: new Date().toISOString(),
    warehouseId: WAREHOUSE_ID,
    lines: [
      {
        assembledItemId: ASSEMBLED_ID,
        assembledQuantity: 10,
        components: [
          { componentItemId: COMPONENT_A_ID, quantity: 2 }, // 2×10=20 units × 4 = 80
          { componentItemId: COMPONENT_B_ID, quantity: 1 }, // 1×10=10 units × 6 = 60
        ],
      },
    ],
  });

  const glCtx = { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: FISCAL_YEAR_ID, userId: 'phase2-test' };
  await assemblyService.postAssembly(COMPANY_ID, assembly.id, glCtx);

  assertClose(await warehouseQty(COMPONENT_A_ID, WAREHOUSE_ID), 80, 'Component A consumed 20 units (100-20)');
  assertClose(await warehouseQty(COMPONENT_B_ID, WAREHOUSE_ID), 90, 'Component B consumed 10 units (100-10)');
  assertClose(await warehouseQty(ASSEMBLED_ID, WAREHOUSE_ID), 10, 'Assembled item received 10 units');

  // True BOM cost: (20×4 + 10×6) / 10 = (80+60)/10 = 14 per unit — never a
  // client-supplied guess.
  const assembledCost = await itemCostService.getCostAsOf(COMPANY_ID, ASSEMBLED_ID, new Date());
  assertClose(assembledCost, 14, 'Assembled item cost is the true rolled-up BOM cost (14/unit)');

  // Components (inventory 1300) and finished item (finished-goods 1310) sit
  // on different control accounts, so the transformation must produce a
  // real, balanced 2-line JE: debit finished goods 140, credit inventory 140.
  const year = String(new Date().getUTCFullYear());
  const je = await activeJe('ASM', 'ASM-P2-001', year);
  check(!!je, 'Assembly GL transformation entry posted (C3)');
  if (je) {
    const debit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    assertClose(debit, 140, 'Debit = true rolled-up BOM cost 20×4+10×6=140');
    assertClose(credit, 140, 'Credit = same 140 out of component inventory account');
    check(Math.abs(debit - credit) < 0.0001, 'Assembly JE balances exactly');
  }

  await assemblyService.unpostAssembly(COMPANY_ID, assembly.id, glCtx);
  assertClose(await warehouseQty(COMPONENT_A_ID, WAREHOUSE_ID), 100, 'Component A restored to 100 after unpost');
  assertClose(await warehouseQty(COMPONENT_B_ID, WAREHOUSE_ID), 100, 'Component B restored to 100 after unpost');
  assertClose(await warehouseQty(ASSEMBLED_ID, WAREHOUSE_ID), 0, 'Assembled item removed after unpost');
}

async function testDisassembly() {
  console.log('\n-- Disassembly (C3, mirror of assembly) --');
  await seedOpeningBalance(DSM_ITEM_ID, WAREHOUSE_ID, 10, 14); // total value 140

  const disassembly = await disassemblyService.createDisassembly(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'DSM-P2-001',
    date: new Date().toISOString(),
    warehouseId: WAREHOUSE_ID,
    lines: [
      {
        disassembledItemId: DSM_ITEM_ID,
        disassembledQuantity: 10,
        components: [
          { componentItemId: DSM_COMPONENT_A_ID, quantity: 2, unitPrice: 4 }, // weight 8 -> 80
          { componentItemId: DSM_COMPONENT_B_ID, quantity: 1, unitPrice: 6 }, // weight 6 -> 60
        ],
      },
    ],
  });

  const glCtx = { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: FISCAL_YEAR_ID, userId: 'phase2-test' };
  await disassemblyService.postDisassembly(COMPANY_ID, disassembly.id, glCtx);

  assertClose(await warehouseQty(DSM_ITEM_ID, WAREHOUSE_ID), 0, 'Disassembled item consumed to 0');
  assertClose(await warehouseQty(DSM_COMPONENT_A_ID, WAREHOUSE_ID), 20, 'Component A received 20 units (2×10)');
  assertClose(await warehouseQty(DSM_COMPONENT_B_ID, WAREHOUSE_ID), 10, 'Component B received 10 units (1×10)');

  const year = String(new Date().getUTCFullYear());
  const je = await activeJe('DSM', 'DSM-P2-001', year);
  check(!!je, 'Disassembly GL transformation entry posted (C3)');
  if (je) {
    const debit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    assertClose(debit, 140, 'Debit inventory = allocated component value 80+60=140');
    assertClose(credit, 140, 'Credit finished goods = relieved value 140');
    check(Math.abs(debit - credit) < 0.0001, 'Disassembly JE balances exactly');
  }

  await disassemblyService.unpostDisassembly(COMPANY_ID, disassembly.id, glCtx);
  assertClose(await warehouseQty(DSM_ITEM_ID, WAREHOUSE_ID), 10, 'Disassembled item restored to 10 after unpost');
  assertClose(await warehouseQty(DSM_COMPONENT_A_ID, WAREHOUSE_ID), 0, 'Component A removed after unpost');
  assertClose(await warehouseQty(DSM_COMPONENT_B_ID, WAREHOUSE_ID), 0, 'Component B removed after unpost');
  check((await activeJe('DSM', 'DSM-P2-001', year)) === null, 'Disassembly JE reversed on unpost');
}

async function testIssue() {
  console.log('\n-- Issue (H1) --');
  await seedOpeningBalance(ISSUE_ITEM_ID, WAREHOUSE_ID, 50, 5);

  const issue = await issueService.createIssue(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'ISS-P2-001',
    date: new Date().toISOString(),
    warehouseId: WAREHOUSE_ID,
    lines: [{ itemId: ISSUE_ITEM_ID, quantity: 15, unitPrice: 5, total: 75 }],
  });

  const glCtx = { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: FISCAL_YEAR_ID, userId: 'phase2-test' };
  await issueService.postIssue(COMPANY_ID, issue.id, glCtx);

  assertClose(await warehouseQty(ISSUE_ITEM_ID, WAREHOUSE_ID), 35, 'Qty reduced to 35 after issue (50-15)');

  const movement = await prisma.inventoryMovement.findFirst({
    where: { companyId: COMPANY_ID, itemId: ISSUE_ITEM_ID, sourceType: 'GI', sourceNumber: 'ISS-P2-001' },
  });
  check(!!movement, 'InventoryMovement audit row created for issue (H1)');
  assertClose(Number(movement?.quantityDelta ?? 0), -15, 'Issue movement delta is -15');

  const year = String(new Date().getUTCFullYear());
  const je = await activeJe('GI', 'ISS-P2-001', year);
  check(!!je, 'Goods-issue GL entry posted');
  if (je) {
    const debit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    assertClose(debit, 75, 'Issue debits expense 15×5=75');
    check(Math.abs(debit - credit) < 0.0001, 'Issue JE balances exactly');
  }

  await issueService.unpostIssue(COMPANY_ID, issue.id, glCtx);
  assertClose(await warehouseQty(ISSUE_ITEM_ID, WAREHOUSE_ID), 50, 'Qty restored to 50 after unpost');
  check((await activeJe('GI', 'ISS-P2-001', year)) === null, 'Issue JE reversed on unpost');
}

async function testReceipt() {
  console.log('\n-- Receipt (H1) --');

  const receipt = await receiptService.createReceipt(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'GR-P2-001',
    date: new Date().toISOString(),
    warehouseId: WAREHOUSE_ID,
    lines: [{ itemId: RECEIPT_ITEM_ID, quantity: 20, unitPrice: 8, total: 160 }],
  });

  const glCtx = { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: FISCAL_YEAR_ID, userId: 'phase2-test' };
  await receiptService.postReceipt(COMPANY_ID, receipt.id, glCtx);

  assertClose(await warehouseQty(RECEIPT_ITEM_ID, WAREHOUSE_ID), 20, 'Qty increased to 20 after receipt');

  const movement = await prisma.inventoryMovement.findFirst({
    where: { companyId: COMPANY_ID, itemId: RECEIPT_ITEM_ID, sourceType: 'GR', sourceNumber: 'GR-P2-001' },
  });
  check(!!movement, 'InventoryMovement audit row created for receipt (H1)');
  assertClose(Number(movement?.unitCost ?? 0), 8, 'Receipt movement carries the receipt unit cost');

  const year = String(new Date().getUTCFullYear());
  const je = await activeJe('GR', 'GR-P2-001', year);
  check(!!je, 'Goods-receipt GL entry posted');
  if (je) {
    const debit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    assertClose(debit, 160, 'Receipt debits inventory 20×8=160');
    check(Math.abs(debit - credit) < 0.0001, 'Receipt JE balances exactly');
  }

  await receiptService.unpostReceipt(COMPANY_ID, receipt.id, glCtx);
  assertClose(await warehouseQty(RECEIPT_ITEM_ID, WAREHOUSE_ID), 0, 'Qty restored to 0 after unpost');
  check((await activeJe('GR', 'GR-P2-001', year)) === null, 'Receipt JE reversed on unpost');
}

async function testOpeningStock() {
  console.log('\n-- Opening stock (H1, takes effect at create — not post) --');
  const glCtx = { companyId: COMPANY_ID, branchId: BRANCH_ID, fiscalYearId: FISCAL_YEAR_ID, userId: 'phase2-test' };

  const opening = await openingStockService.createOpeningStock(
    COMPANY_ID,
    {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      serial: 'OB-P2-001',
      date: new Date().toISOString(),
      lines: [{ itemId: OPEN_ITEM_ID, warehouseId: WAREHOUSE_ID, quantity: 30, unitPrice: 3, total: 90 }],
    },
    glCtx
  );

  assertClose(
    await warehouseQty(OPEN_ITEM_ID, WAREHOUSE_ID),
    30,
    'Opening stock quantity applied immediately at create (documented existing behaviour)'
  );

  const movement = await prisma.inventoryMovement.findFirst({
    where: { companyId: COMPANY_ID, itemId: OPEN_ITEM_ID, sourceType: 'OB', sourceNumber: 'OB-P2-001' },
  });
  check(!!movement, 'InventoryMovement audit row created for opening stock (H1)');

  assertClose(
    await itemCostService.getCostAsOf(COMPANY_ID, OPEN_ITEM_ID, new Date()),
    3,
    'Opening stock also seeds the item average cost (inventory-truth fix)'
  );

  const year = String(new Date().getUTCFullYear());
  const je = await activeJe('OB', 'OB-P2-001', year);
  check(!!je, 'Opening stock GL entry posted (inventory-truth fix)');
  if (je) {
    const debit = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    assertClose(debit, 90, 'Opening balance debits inventory 30×3=90');
    check(Math.abs(debit - credit) < 0.0001, 'Opening stock JE balances exactly');
  }

  await openingStockService.postOpeningStock(COMPANY_ID, opening.id);
  assertClose(await warehouseQty(OPEN_ITEM_ID, WAREHOUSE_ID), 30, 'Posting does not change quantity (already applied)');

  await openingStockService.unpostOpeningStock(COMPANY_ID, opening.id, glCtx);
  assertClose(await warehouseQty(OPEN_ITEM_ID, WAREHOUSE_ID), 0, 'Qty reversed to 0 after unpost');
  check((await activeJe('OB', 'OB-P2-001', year)) === null, 'Opening stock JE reversed on unpost (C11)');

  // Cancelling a still-draft (never posted) opening stock must reverse the
  // create-time quantity effect too — otherwise it leaks forever.
  const draft = await openingStockService.createOpeningStock(
    COMPANY_ID,
    {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      serial: 'OB-P2-002',
      date: new Date().toISOString(),
      lines: [{ itemId: OPEN_ITEM_ID, warehouseId: WAREHOUSE_ID, quantity: 12, unitPrice: 3, total: 36 }],
    },
    glCtx
  );
  assertClose(await warehouseQty(OPEN_ITEM_ID, WAREHOUSE_ID), 12, 'Draft opening stock qty applied at create');

  await openingStockService.cancelOpeningStock(COMPANY_ID, draft.id, glCtx);
  assertClose(await warehouseQty(OPEN_ITEM_ID, WAREHOUSE_ID), 0, 'Cancelling a draft reverses its quantity effect (no leak)');
  check((await activeJe('OB', 'OB-P2-002', year)) === null, 'Draft opening stock GL entry reversed on cancel');

  await openingStockService.restoreOpeningStock(COMPANY_ID, draft.id, glCtx);
  assertClose(await warehouseQty(OPEN_ITEM_ID, WAREHOUSE_ID), 12, 'Restoring a cancelled draft re-applies its quantity');
  check(!!(await activeJe('OB', 'OB-P2-002', year)), 'Restoring a cancelled draft re-posts its GL entry');
}

async function testPurchaseReturn() {
  console.log('\n-- Purchase return (H1) --');
  await seedOpeningBalance(PRT_ITEM_ID, WAREHOUSE_ID, 40, 7);

  const ret = await purchaseReturnService.createPurchaseReturn(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'PRT-P2-001',
    date: new Date().toISOString(),
    supplierId: SUPPLIER_ID,
    warehouseId: WAREHOUSE_ID,
    lines: [
      {
        itemId: PRT_ITEM_ID,
        unitId: UNIT_ID,
        quantity: 10,
        baseQuantity: 10,
        unitPrice: 7,
        total: 70,
        netTotal: 70,
      },
    ],
  });

  await purchaseReturnService.postPurchaseReturn(COMPANY_ID, ret.id);

  assertClose(await warehouseQty(PRT_ITEM_ID, WAREHOUSE_ID), 30, 'Qty reduced to 30 after purchase return (40-10)');

  const movement = await prisma.inventoryMovement.findFirst({
    where: { companyId: COMPANY_ID, itemId: PRT_ITEM_ID, sourceType: 'PRT', sourceNumber: 'PRT-P2-001' },
  });
  check(!!movement, 'InventoryMovement audit row created for purchase return (H1)');
  assertClose(Number(movement?.quantityDelta ?? 0), -10, 'Purchase return movement delta is -10');

  const supplierAfterPost = await prisma.supplier.findUnique({ where: { id: SUPPLIER_ID } });
  assertClose(Number(supplierAfterPost?.balance ?? 0), -70, 'Supplier balance decremented by return net amount');

  await purchaseReturnService.unpostPurchaseReturn(COMPANY_ID, ret.id);
  assertClose(await warehouseQty(PRT_ITEM_ID, WAREHOUSE_ID), 40, 'Qty restored to 40 after unpost');
  const supplierAfterUnpost = await prisma.supplier.findUnique({ where: { id: SUPPLIER_ID } });
  assertClose(Number(supplierAfterUnpost?.balance ?? 0), 0, 'Supplier balance restored after unpost');
}

/**
 * Runs after every other Phase-2 scenario has posted/unposted its way back
 * to a resting state. If any StockMovementService quantity mutation was
 * ever missing its matching GL contra-entry (or vice versa), the GL
 * inventory account balance and the stock ledger valuation would drift
 * apart here — this is the true end-to-end check for the permanent
 * inventory-to-GL reconciliation report, not a hand-recomputed number.
 */
async function testReconciliation() {
  console.log('\n-- Inventory-to-GL reconciliation report (Phase 2 permanent control) --');

  const report = await inventoryGlReconciliationService.getReconciliation({ companyId: COMPANY_ID });

  check(report.isReconciled, `Company-wide GL matches stock ledger (variance ${report.variance})`);
  for (const acct of report.accountBreakdown) {
    check(
      acct.isReconciled,
      `Account ${acct.accountCode} reconciled: GL ${acct.glBalance} vs stock ${acct.stockLedgerValue} (variance ${acct.variance})`
    );
  }
  check(report.flaggedItems.length === 0, `No flagged items (negative stock / missing cost): ${report.flaggedItems.map((f) => f.itemName).join(', ')}`);
}

async function main() {
  console.log('Phase 2 — inventory ops (stocktaking/adjustment/transfer/assembly) — start');
  await seed();
  await resetFixtureData();

  await testStocktaking();
  await testAdjustment();
  await testTransfer();
  await testAssembly();
  await testDisassembly();
  await testIssue();
  await testReceipt();
  await testOpeningStock();
  await testPurchaseReturn();
  await testReconciliation();

  if (failures.length > 0) {
    console.error(`\nPhase 2 inventory ops — FAILED (${failures.length} failure(s)):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nPhase 2 inventory ops — PASSED');
}

main()
  .catch((e) => {
    console.error('Phase 2 inventory ops — FAILED (exception)');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
