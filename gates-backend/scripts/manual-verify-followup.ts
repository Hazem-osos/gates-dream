/**
 * Manual exercise for the final-verification to-do in
 * accounting_and_wiring_verification_6c8aac0d.plan.md:
 *   - a WHT-bearing CASH sale invoice settles with zero phantom remainder
 *     (regression check for the wht-cash-settle fix).
 *   - a priceless (zero-price) inventory adjustment line posts its GL
 *     variance at the moving-average cost instead of zero
 *     (regression check for the adjustment-cost-fallback fix).
 *
 * Run: npx tsx scripts/manual-verify-followup.ts
 */
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { invoicePostingOrchestrator } from '../src/modules/invoices/services/invoice-posting-orchestrator.js';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { itemCostService } from '../src/modules/inventory/services/item-cost.service.js';
import { adjustmentService } from '../src/modules/inventory/services/adjustment.service.js';
import { upsertCompanySetting } from './lib/upsert-company-setting.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-0000000000f1';
const BRANCH_ID = '00000000-0000-0000-0000-0000000000f2';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-0000000000f3';
const WAREHOUSE_ID = '00000000-0000-0000-0000-0000000000f4';
const ITEM_ID = '00000000-0000-0000-0000-0000000000f5';
const UNIT_ID = '00000000-0000-0000-0000-0000000000f6';
const CUSTOMER_ID = '00000000-0000-0000-0000-0000000000f7';
const SAFE_ID = '00000000-0000-0000-0000-0000000000f8';
const SUPPLIER_ID = '00000000-0000-0000-0000-0000000000f9';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}
function assertClose(a: number, b: number, msg: string, eps = 0.02) {
  if (Math.abs(a - b) > eps) throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
}

async function seed() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { isActive: true },
    create: { id: COMPANY_ID, arabicName: 'Followup Test Co', englishName: 'Followup Test Co', isActive: true },
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
    CreditWarningOnly: 'F',
    ApprovalEnforceCreditLimit: 'F',
  };
  for (const [name, value] of Object.entries(glSettings)) {
    await upsertCompanySetting(prisma, COMPANY_ID, name, value);
  }

  const accountSpecs = [
    { code: '1300', arabicName: 'Inventory', type: 'asset' },
    { code: '1200', arabicName: 'AR', type: 'asset' },
    { code: '4100', arabicName: 'Sales', type: 'revenue' },
    { code: '5100', arabicName: 'COGS', type: 'expense' },
    { code: '2200', arabicName: 'VAT Input', type: 'asset' },
    { code: '2300', arabicName: 'VAT Output', type: 'liability' },
    { code: '1250', arabicName: 'WHT Receivable', type: 'asset' },
    { code: '1100', arabicName: 'Cash', type: 'asset' },
    { code: '5900', arabicName: 'Inventory Variance', type: 'expense' },
    { code: '2100', arabicName: 'AP', type: 'liability' },
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
        inventoryAccount: '1300',
        salesRevenueAccount: '4100',
        cogsAccount: '5100',
        vatInputAccount: '2200',
        vatOutputAccount: '2300',
        whtReceivableAccount: '1250',
        cashAccount: '1100',
        arAccount: '1200',
        apAccount: '2100',
        inventoryAdjustmentAccount: '5900',
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
        whtReceivableAccount: '1250',
        cashAccount: '1100',
        arAccount: '1200',
        apAccount: '2100',
        inventoryAdjustmentAccount: '5900',
      },
      allowNegativeBalance: false,
    },
  });

  const ar = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '1200' } });
  const ap = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '2100' } });
  const inv = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '1300' } });
  assert(!!ar && !!ap && !!inv, 'Core accounts seeded');

  await prisma.supplier.upsert({
    where: { id: SUPPLIER_ID },
    update: { mainAccountId: ap!.id, balance: 0 },
    create: { id: SUPPLIER_ID, companyId: COMPANY_ID, arabicName: 'Followup Supplier', mainAccountId: ap!.id, balance: 0 },
  });

  await prisma.customer.upsert({
    where: { id: CUSTOMER_ID },
    update: { mainAccountId: ar!.id, creditLimit: 100000, balance: 0 },
    create: {
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      arabicName: 'Followup Customer',
      mainAccountId: ar!.id,
      creditLimit: 100000,
      balance: 0,
    },
  });

  await prisma.warehouse.upsert({
    where: { id: WAREHOUSE_ID },
    update: { isActive: true },
    create: { id: WAREHOUSE_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, arabicName: 'Main WH', code: 'FWH01', isActive: true },
  });

  await prisma.unit.upsert({
    where: { companyId_code: { companyId: COMPANY_ID, code: 'PCS' } },
    update: {},
    create: { id: UNIT_ID, companyId: COMPANY_ID, code: 'PCS', arabicName: 'Piece' },
  });

  await prisma.item.upsert({
    where: { id: ITEM_ID },
    update: { mainAccountId: inv!.id },
    create: { id: ITEM_ID, companyId: COMPANY_ID, serial: 'FW-ITEM', arabicName: 'Followup Item', mainAccountId: inv!.id },
  });

  await prisma.itemUnit.upsert({
    where: { itemId_unitId: { itemId: ITEM_ID, unitId: UNIT_ID } },
    update: {},
    create: { itemId: ITEM_ID, unitId: UNIT_ID, conversionFactor: 1, isBaseUnit: true },
  });

  const cashAcc = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code: '1100' } });
  await prisma.safe.upsert({
    where: { id: SAFE_ID },
    update: { glAccountId: cashAcc!.id, balance: 0, isActive: true },
    create: {
      id: SAFE_ID,
      companyId: COMPANY_ID,
      code: 'FSAFE',
      arabicName: 'Followup Safe',
      currencyCode: 'EGP',
      glAccountId: cashAcc!.id,
      balance: 0,
      isActive: true,
    },
  });

  // Idempotency: wipe prior runs of this script's fixtures.
  const staleInvoices = await prisma.invoice.findMany({
    where: { companyId: COMPANY_ID, invoiceNumber: { in: ['FW-SI-WHT-CASH-001', 'FW-PI-SEED-001'] } },
    select: { id: true, journalEntryId: true, costJournalEntryId: true },
  });
  const staleIds = staleInvoices.map((i) => i.id);
  if (staleIds.length > 0) {
    const staleJeIds = staleInvoices.flatMap((i) => [i.journalEntryId, i.costJournalEntryId]).filter((x): x is string => !!x);
    await prisma.paymentAllocation.deleteMany({ where: { invoiceId: { in: staleIds } } });
    await prisma.cashTransaction.deleteMany({ where: { invoiceId: { in: staleIds } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: staleIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: staleIds } } });
    if (staleJeIds.length > 0) {
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: staleJeIds } } });
      await prisma.journalEntry.deleteMany({ where: { id: { in: staleJeIds } } });
    }
  }
  await prisma.adjustment.deleteMany({ where: { companyId: COMPANY_ID, serial: 'FW-ADJ-001' } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId: COMPANY_ID, itemId: ITEM_ID } });
  await prisma.itemCostHistory.deleteMany({ where: { companyId: COMPANY_ID, itemId: ITEM_ID } });
  const qty = await prisma.itemQuantity.findFirst({ where: { itemId: ITEM_ID, warehouseId: WAREHOUSE_ID, locationId: null } });
  if (qty) await prisma.itemQuantity.update({ where: { id: qty.id }, data: { quantity: 0 } });
}

async function testWhtCashInvoice(ctx: ReturnType<typeof invoicePostingContextFromIds>) {
  console.log('\n--- Test 1: WHT-bearing CASH sale invoice ---');
  // Seed 100 units @ cost 10 via a posted purchase invoice, so the moving-
  // average cost engine (itemCostService) is actually primed — plain
  // adjustments move quantity but never touch ItemCostHistory.
  const seedPi = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, FISCAL_YEAR_ID, {
    invoiceKind: 'PURCHASE',
    invoiceNumber: 'FW-PI-SEED-001',
    date: new Date(),
    currencyCode: 'EGP',
    supplierId: SUPPLIER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: String(new Date().getFullYear()),
    lines: [{ itemId: ITEM_ID, unitId: UNIT_ID, quantity: 100, baseQuantity: 100, price: 10, taxPercent: 0, taxAmount: 0, lineOrder: 1 }],
  } as any);
  await invoicePostingOrchestrator.post(ctx, seedPi!.id);

  const net = 1000; // gross merchandise, no tax for simplicity
  const wht = 50; // 5% WHT withheld by the customer
  const si = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, FISCAL_YEAR_ID, {
    invoiceKind: 'SALE',
    invoiceNumber: 'FW-SI-WHT-CASH-001',
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: String(new Date().getFullYear()),
    paymentMethod: 'CASH',
    withholdingTaxAmount: wht,
    lines: [
      { itemId: ITEM_ID, unitId: UNIT_ID, quantity: 10, baseQuantity: 10, price: net / 10, taxPercent: 0, taxAmount: 0, lineOrder: 1 },
    ],
  } as any);
  assert(!!si, 'WHT cash invoice created');
  assertClose(Number(si!.netAmount), net - wht, 'netAmount is stored net-of-WHT at create time');

  const posted = await invoicePostingOrchestrator.post(ctx, si!.id);
  const after = await prisma.invoice.findUnique({ where: { id: posted.invoice.id } });
  assert(!!after, 'Invoice still exists after post');

  console.log(`  netAmount=${after!.netAmount} paidAmount=${after!.paidAmount} remainingAmount=${after!.remainingAmount}`);
  assertClose(Number(after!.paidAmount), Number(after!.netAmount), 'Cash leg fully settles net-of-WHT amount (no phantom WHT-sized remainder)');
  assertClose(Number(after!.remainingAmount), 0, 'Remaining amount is zero for a fully cash-settled WHT invoice');

  const customer = await prisma.customer.findUnique({ where: { id: CUSTOMER_ID } });
  assertClose(Number(customer!.balance), 0, 'Customer balance stays at zero — cash invoice never carries a receivable');

  console.log('  PASS: WHT cash invoice settles cleanly, no phantom remainder.');
}

async function testPricelessAdjustment() {
  console.log('\n--- Test 2: priceless (zero-price) inventory adjustment ---');
  const avgCostBefore = await itemCostService.getCostAsOf(COMPANY_ID, ITEM_ID, new Date());
  assert(avgCostBefore > 0, 'Item has a nonzero moving-average cost going into the adjustment (from Test 1 seed)');
  console.log(`  moving-average cost before adjustment: ${avgCostBefore}`);

  const adj = await adjustmentService.createAdjustment(COMPANY_ID, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    serial: 'FW-ADJ-001',
    date: new Date().toISOString(),
    warehouseId: WAREHOUSE_ID,
    // No unitPrice supplied — this is the "priceless" adjustment scenario.
    lines: [{ itemId: ITEM_ID, bookQuantity: 90, actualQuantity: 100, unitPrice: 0 }],
  });

  await adjustmentService.postAdjustment(COMPANY_ID, adj.id, {
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'followup-test',
  } as any);

  const variance = await prisma.journalEntry.findFirst({
    where: { companyId: COMPANY_ID, sourceType: 'ADJ', sourceNumber: 'FW-ADJ-001', entryType: 'ADJUSTMENT' },
    include: { lines: true },
  });
  assert(!!variance, 'Adjustment variance JE was created for the priceless line');
  const inventoryLine = variance!.lines.find((l) => Number(l.debit) > 0 || Number(l.credit) > 0);
  assert(!!inventoryLine, 'Variance JE has a nonzero line');
  const magnitude = Math.max(Number(inventoryLine!.debit), Number(inventoryLine!.credit));
  console.log(`  variance JE line magnitude: ${magnitude} (expected ~10 × ${avgCostBefore} = ${10 * avgCostBefore})`);
  assertClose(magnitude, 10 * avgCostBefore, 'Zero-price adjustment line is valued at moving-average cost, not zero', 0.5);

  console.log('  PASS: priceless adjustment posts a nonzero GL variance at moving-average cost.');
}

async function main() {
  console.log('Manual follow-up verification — start');
  await seed();
  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'followup-test',
  });
  await testWhtCashInvoice(ctx);
  await testPricelessAdjustment();
  console.log('\nManual follow-up verification — PASSED');
}

main()
  .catch((e) => {
    console.error('\nManual follow-up verification — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
