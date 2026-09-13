/**
 * Wave 3 — M8 manufacturing integration test.
 * Run: npm run test:wave3-manufacturing
 */
import { PrismaClient } from '@prisma/client';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { bomService } from '../src/modules/manufacturing/services/bom.service.js';
import { productionOrderService } from '../src/modules/manufacturing/services/production-order.service.js';
import { itemCostService } from '../src/modules/inventory/services/item-cost.service.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const RAW1_ID = '00000000-0000-0000-0000-0000000000a1';
const RAW2_ID = '00000000-0000-0000-0000-0000000000a2';
const FG_ID = '00000000-0000-0000-0000-0000000000a3';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertClose(a: number, b: number, msg: string, eps = 0.05) {
  if (Math.abs(a - b) > eps) {
    throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
  }
}

async function warehouseQty(itemId: string): Promise<number> {
  const row = await prisma.itemQuantity.findFirst({
    where: { itemId, warehouseId: WAREHOUSE_ID, locationId: null },
  });
  return row ? Number(row.quantity) : 0;
}

async function assertJournalPostedBalanced(journalEntryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { lines: true },
  });
  assert(!!entry, 'Journal exists');
  const totals = journalPostingService.computeBaseTotals(
    entry!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(totals.debitBase, totals.creditBase, 'Journal balanced');
}

async function seedManufacturingFixtures() {
  const glAccounts = [
    { code: '1501', arabicName: 'WIP Materials', type: 'asset' },
    { code: '1502', arabicName: 'WIP Labor OH', type: 'asset' },
    { code: '1310', arabicName: 'Raw Inventory', type: 'asset' },
    { code: '1320', arabicName: 'Finished Goods', type: 'asset' },
    { code: '5205', arabicName: 'OH Absorption', type: 'expense' },
  ];
  for (const a of glAccounts) {
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

  await prisma.manufacturingSettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {},
    create: {
      companyId: COMPANY_ID,
      wipMaterialsAccountCode: '1501',
      wipLaborOverheadAccountCode: '1502',
      rawInventoryAccountCode: '1310',
      finishedGoodsAccountCode: '1320',
      overheadAbsorptionAccountCode: '5205',
    },
  });

  const inv = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1300' },
  });

  for (const [id, serial, name] of [
    [RAW1_ID, 'RAW-1', 'Raw Material A'],
    [RAW2_ID, 'RAW-2', 'Raw Material B'],
    [FG_ID, 'FG-1', 'Finished Product'],
  ] as const) {
    await prisma.item.upsert({
      where: { id },
      update: { isActive: true },
      create: {
        id,
        companyId: COMPANY_ID,
        serial,
        arabicName: name,
        mainAccountId: inv?.id,
      },
    });
    const qty = await prisma.itemQuantity.findFirst({
      where: { itemId: id, warehouseId: WAREHOUSE_ID, locationId: null },
    });
    if (qty) {
      await prisma.itemQuantity.update({
        where: { id: qty.id },
        data: { quantity: id === FG_ID ? 0 : 500 },
      });
    } else {
      await prisma.itemQuantity.create({
        data: {
          itemId: id,
          warehouseId: WAREHOUSE_ID,
          quantity: id === FG_ID ? 0 : 500,
        },
      });
    }
  }

  await prisma.itemCostHistory.deleteMany({
    where: {
      companyId: COMPANY_ID,
      itemId: { in: [RAW1_ID, RAW2_ID, FG_ID] },
    },
  });

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID },
  });
  const yearId = fiscalYear?.legacyYearId ?? '2026';
  const now = new Date();

  await itemCostService.applyMovingAverage({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    itemId: RAW1_ID,
    invoiceDate: now,
    itemCount: 100,
    itemPrice: 10,
    sourceNum: 'SEED-R1',
    sourceYearId: yearId,
    sourceType: 'PI',
  });
  await itemCostService.applyMovingAverage({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    itemId: RAW2_ID,
    invoiceDate: now,
    itemCount: 100,
    itemPrice: 5,
    sourceNum: 'SEED-R2',
    sourceYearId: yearId,
    sourceType: 'PI',
  });

  await prisma.inventoryMovement.deleteMany({
    where: {
      companyId: COMPANY_ID,
      itemId: { in: [RAW1_ID, RAW2_ID, FG_ID] },
      sourceType: 'MO',
    },
  });
}

async function main() {
  console.log('Wave3 manufacturing integration test — start');

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fiscalYear, 'Run test:wave1-invoices for fixtures');

  await seedManufacturingFixtures();

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave3-mfg-test',
  });

  const bom = await bomService.create(COMPANY_ID, {
    name: 'FG Recipe v1',
    finishedItemId: FG_ID,
    baseQuantity: 1,
    standardLaborCost: 8,
    standardOverheadCost: 2,
    lines: [
      { rawItemId: RAW1_ID, quantity: 2, scrapPercentage: 0 },
      { rawItemId: RAW2_ID, quantity: 2, scrapPercentage: 0 },
    ],
  });

  const orderNo = `MO-${Date.now()}`;
  const order = await productionOrderService.create(COMPANY_ID, {
    orderNumber: orderNo,
    bomId: bom.id,
    plannedQuantity: 1,
    warehouseIdRaw: WAREHOUSE_ID,
    warehouseIdFinished: WAREHOUSE_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    sourceYearId: fiscalYear!.legacyYearId,
  });
  assert(order.status === 'DRAFT', 'Order draft');

  const raw1Before = await warehouseQty(RAW1_ID);
  const raw2Before = await warehouseQty(RAW2_ID);

  await productionOrderService.release(COMPANY_ID, order.id);

  const issued = await productionOrderService.issueMaterials(ctx, order.id);
  assert(issued.status === 'IN_PROGRESS', 'In progress after issue');
  const materialCost = Number(issued.totalMaterialCost);
  assert(materialCost > 25 && materialCost < 35, `Material cost in expected band (got ${materialCost})`);
  assert(!!issued.materialsIssueJournalEntryId, 'Material JE');
  await assertJournalPostedBalanced(issued.materialsIssueJournalEntryId!);

  assertClose(await warehouseQty(RAW1_ID), raw1Before - 2, 'Raw1 decremented');
  assertClose(await warehouseQty(RAW2_ID), raw2Before - 2, 'Raw2 decremented');

  await productionOrderService.addLaborOverhead(ctx, order.id, 8, 2);

  const expectedUnit = materialCost + 10;

  const completed = await productionOrderService.complete(ctx, order.id, 1);
  assert(completed.status === 'COMPLETED', 'Order completed');
  assertClose(Number(completed.unitCost), expectedUnit, 'Unit cost batch/1', 1);
  assert(!!completed.completionJournalEntryId, 'Completion JE');
  await assertJournalPostedBalanced(completed.completionJournalEntryId!);

  assertClose(await warehouseQty(FG_ID), 1, 'FG qty incremented');

  const fgCost = await itemCostService.getCostAsOf(COMPANY_ID, FG_ID, new Date());
  assertClose(fgCost, expectedUnit, 'FG moving average cost', 1);

  const completionJe = await prisma.journalEntry.findUnique({
    where: { id: completed.completionJournalEntryId! },
    include: { lines: { include: { account: true } } },
  });
  const wipMatCredit = completionJe!.lines.find(
    (l) => l.account.code === '1501' && Number(l.credit) > 0
  );
  const wipOhCredit = completionJe!.lines.find(
    (l) => l.account.code === '1502' && Number(l.credit) > 0
  );
  assert(!!wipMatCredit, 'WIP materials cleared');
  assert(!!wipOhCredit, 'WIP labor/OH cleared');
  assertClose(Number(wipMatCredit!.credit), materialCost, 'WIP materials amount', 1);
  assertClose(Number(wipOhCredit!.credit), 10, 'WIP labor/OH amount');

  console.log('Wave3 manufacturing integration test — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
