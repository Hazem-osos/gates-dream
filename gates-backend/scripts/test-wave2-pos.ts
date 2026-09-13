/**
 * Wave 2 — M6 POS integration test.
 * Run: npm run test:wave2-pos
 */
import { PrismaClient } from '@prisma/client';
import { posShiftService } from '../src/modules/pos/services/pos-shift.service.js';
import { posOrderPostingService } from '../src/modules/pos/services/pos-order-posting.service.js';
import { posPostingContextFromIds } from '../src/modules/pos/services/pos-posting-context.js';
import { journalPostingService } from '../src/modules/accounting/services/journal-posting.service.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const ITEM_ID = '00000000-0000-0000-0000-000000000040';
const UNIT_ID = '00000000-0000-0000-0000-000000000041';
const SAFE_ID = '00000000-0000-0000-0000-000000000070';
const BANK_ACCOUNT_ID = '00000000-0000-0000-0000-000000000072';
const TERMINAL_ID = '00000000-0000-0000-0000-000000000090';
const TAX_PERIOD_ID = '00000000-0000-0000-0000-000000000080';

const TAX = 14;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertClose(a: number, b: number, msg: string, eps = 0.05) {
  if (Math.abs(a - b) > eps) throw new Error(`ASSERT: ${msg} (expected ${b}, got ${a})`);
}

function saleLine(qty: number, price: number, order: number) {
  return {
    itemId: ITEM_ID,
    unitId: UNIT_ID,
    quantity: qty,
    price,
    taxPercent: TAX,
    lineOrder: order,
  };
}

function netFromMerch(merch: number) {
  const tax = (merch * TAX) / 100;
  return merch + tax;
}

async function seedPosFixtures() {
  await prisma.taxPeriod.updateMany({
    where: { companyId: COMPANY_ID, id: TAX_PERIOD_ID },
    data: { status: 'OPEN', closedAt: null },
  });

  // Merge into whatever accountDefinitions other shared-fixture scripts already set
  // instead of clobbering them (this company row is reused across all wave*.ts scripts).
  const existingPosSettings = await prisma.companySettings.findUnique({ where: { companyId: COMPANY_ID } });
  const existingPosDefs = (existingPosSettings?.accountDefinitions as Record<string, string>) ?? {};
  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      accountDefinitions: {
        ...existingPosDefs,
        inventoryAccount: '1300',
        salesRevenueAccount: '4100',
        cogsAccount: '5100',
        vatOutputAccount: '2300',
        vatInputAccount: '2200',
        taxAuthorityPayableAccount: '2500',
        cashAccount: '1100',
        bankAccount: '1110',
        arAccount: '1200',
        cashShortageAccount: '5200',
        cashSurplusAccount: '4200',
      },
    },
    create: {
      companyId: COMPANY_ID,
      accountDefinitions: {
        inventoryAccount: '1300',
        salesRevenueAccount: '4100',
        cogsAccount: '5100',
        vatOutputAccount: '2300',
        cashAccount: '1100',
        bankAccount: '1110',
        arAccount: '1200',
        cashShortageAccount: '5200',
        cashSurplusAccount: '4200',
      },
    },
  });

  for (const [code, name, type] of [
    ['5200', 'Cash Shortage', 'expense'],
    ['4200', 'Cash Surplus', 'revenue'],
  ]) {
    const ex = await prisma.account.findFirst({ where: { companyId: COMPANY_ID, code } });
    if (!ex) {
      await prisma.account.create({
        data: { companyId: COMPANY_ID, code, arabicName: name, accountType: type, isActive: true },
      });
    }
  }

  await prisma.posTerminal.upsert({
    where: { id: TERMINAL_ID },
    update: { isActive: true },
    create: {
      id: TERMINAL_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      warehouseId: WAREHOUSE_ID,
      safeId: SAFE_ID,
      bankAccountId: BANK_ACCOUNT_ID,
      name: 'POS-1',
      deviceCode: 'POS-DEV-1',
    },
  });

  const qty = await prisma.itemQuantity.findFirst({
    where: { itemId: ITEM_ID, warehouseId: WAREHOUSE_ID, locationId: null },
  });
  if (qty) {
    await prisma.itemQuantity.update({
      where: { id: qty.id },
      data: { quantity: 100 },
    });
  }
}

async function main() {
  console.log('Wave2 POS integration test — start');
  await seedPosFixtures();

  const ctx = posPostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
  });

  await prisma.posShift.updateMany({
    where: { companyId: COMPANY_ID, terminalId: TERMINAL_ID, status: 'OPEN' },
    data: { status: 'CLOSED', closedAt: new Date() },
  });

  const shift = await posShiftService.openShift(ctx, {
    terminalId: TERMINAL_ID,
    openingCash: 500,
    shiftNumber: `SH-${Date.now()}`,
  });

  const ts = Date.now();
  const orders = [
    { n: `POS-C1-${ts}`, merch: 100, method: 'CASH' as const },
    { n: `POS-C2-${ts}`, merch: 150, method: 'CASH' as const },
    { n: `POS-V1-${ts}`, merch: 200, method: 'CARD' as const },
  ];

  // C10 fix: each order now posts its own balanced journal entry immediately
  // — there is no longer a window where stock has moved but the GL hasn't.
  const safeBefore = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
  const bankBefore = await prisma.bankAccount.findUnique({ where: { id: BANK_ACCOUNT_ID } });

  for (const o of orders) {
    const net = netFromMerch(o.merch);
    const draft = await posOrderPostingService.createOrder(COMPANY_ID, shift.id, {
      orderNumber: o.n,
      paymentMethod: o.method,
      cashAmount: o.method === 'CASH' ? net : 0,
      cardAmount: o.method === 'CARD' ? net : 0,
      creditAmount: 0,
      lines: [saleLine(1, o.merch, 1)],
    });
    const posted = await posOrderPostingService.postOrder(ctx, draft!.id);
    assert(!!posted!.journalEntryId, `Order ${o.n} posts its own JE (C10)`);

    const je = await prisma.journalEntry.findUnique({
      where: { id: posted!.journalEntryId! },
      include: { lines: true },
    });
    assert(!!je, `JE exists for order ${o.n}`);
    const totals = journalPostingService.computeBaseTotals(
      je!.lines.map((l) => ({
        debit: Number(l.debit),
        credit: Number(l.credit),
        exchangeRate: Number(l.exchangeRate),
      }))
    );
    assertClose(totals.debitBase, totals.creditBase, `Order ${o.n} JE balanced`);
  }

  const cashNet = netFromMerch(100) + netFromMerch(150);
  const cardNet = netFromMerch(200);
  const declared = 500 + cashNet;

  // Tender balances move at ORDER time now, not at shift close.
  const safeAfterOrders = await prisma.safe.findUnique({ where: { id: SAFE_ID } });
  const bankAfterOrders = await prisma.bankAccount.findUnique({ where: { id: BANK_ACCOUNT_ID } });
  assertClose(
    Number(safeAfterOrders!.balance) - Number(safeBefore!.balance),
    cashNet,
    'Safe balance moved at order-post time, not shift close'
  );
  assertClose(
    Number(bankAfterOrders!.balance) - Number(bankBefore!.balance),
    cardNet,
    'Bank balance moved at order-post time, not shift close'
  );

  const closed = await posShiftService.closeShift(ctx, shift.id, declared);
  assert(closed.shift.status === 'CLOSED', 'Shift closed');
  assertClose(closed.zReport.totalCashSales, cashNet, 'Z cash sales');
  assertClose(closed.zReport.totalCardSales, cardNet, 'Z card sales');
  assertClose(closed.zReport.totalMerchandise, 450, 'Z merchandise');
  assertClose(closed.zReport.totalTaxAmount, 63, 'Z VAT');
  assertClose(closed.zReport.cashVariance, 0, 'Zero cash variance');
  assertClose(closed.zReport.closingCashSystem, declared, 'System drawer balance');

  // Zero variance ⇒ shift close posts NO journal entry at all (it's purely
  // a cash reconciliation act now, not a revenue-recognition one).
  assert(!closed.journalEntryId, 'Zero-variance shift close posts no JE (C10)');

  // ── Second shift: cash shortage produces its own variance JE at close ──
  const shift2 = await posShiftService.openShift(ctx, {
    terminalId: TERMINAL_ID,
    openingCash: 500,
    shiftNumber: `SH2-${Date.now()}`,
  });
  const net2 = netFromMerch(100);
  const draft2 = await posOrderPostingService.createOrder(COMPANY_ID, shift2.id, {
    orderNumber: `POS-V2-${Date.now()}`,
    paymentMethod: 'CASH',
    cashAmount: net2,
    creditAmount: 0,
    lines: [saleLine(1, 100, 1)],
  });
  await posOrderPostingService.postOrder(ctx, draft2!.id);
  const declaredShort = 500 + net2 - 5; // drawer is short by 5
  const closed2 = await posShiftService.closeShift(ctx, shift2.id, declaredShort);
  assertClose(closed2.zReport.cashVariance, -5, 'Shortage recorded (H12/C10)');
  assert(!!closed2.journalEntryId, 'Non-zero variance shift close posts a JE');
  const varianceJe = await prisma.journalEntry.findUnique({
    where: { id: closed2.journalEntryId! },
    include: { lines: true },
  });
  const varianceTotals = journalPostingService.computeBaseTotals(
    varianceJe!.lines.map((l) => ({
      debit: Number(l.debit),
      credit: Number(l.credit),
      exchangeRate: Number(l.exchangeRate),
    }))
  );
  assertClose(varianceTotals.debitBase, varianceTotals.creditBase, 'Variance JE balanced');

  // ── discountPercent line math (H12) ──
  const shift3 = await posShiftService.openShift(ctx, {
    terminalId: TERMINAL_ID,
    openingCash: 0,
    shiftNumber: `SH3-${Date.now()}`,
  });
  const grossMerch = 200; // qty 1 * price 200
  const discPct = 10;
  const merchAfterDisc = grossMerch * (1 - discPct / 100); // 180
  const net3 = netFromMerch(merchAfterDisc);
  const draft3 = await posOrderPostingService.createOrder(COMPANY_ID, shift3.id, {
    orderNumber: `POS-D1-${Date.now()}`,
    paymentMethod: 'CASH',
    cashAmount: net3,
    creditAmount: 0,
    lines: [
      {
        itemId: ITEM_ID,
        unitId: UNIT_ID,
        quantity: 1,
        price: grossMerch,
        discountPercent: discPct,
        taxPercent: TAX,
        lineOrder: 1,
      },
    ],
  });
  assertClose(Number(draft3!.discountAmount), 20, 'discountPercent derives 10% of 200 (H12)');
  assertClose(Number(draft3!.netAmount), net3, 'Net reflects percent-derived discount');
  await posOrderPostingService.postOrder(ctx, draft3!.id);

  console.log('Wave2 POS integration test — PASSED');
}

main()
  .catch((e) => {
    console.error('Wave2 POS integration test — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
