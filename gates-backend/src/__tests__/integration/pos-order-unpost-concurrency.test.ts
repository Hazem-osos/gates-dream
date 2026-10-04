/**
 * CC-03: two unpost requests for the same posted POS order must reverse the
 * journal, stock, drawer/bank, shift totals and customer balance exactly once.
 * The journal is unposted in place, so no second reversal document is created.
 *
 * Needs a real MySQL database. Skipped unless the DATABASE_URL database name
 * contains "test" so it can never write into a dev or production database.
 *
 * `unpostOrder` has no awaited call between its `status` pre-check and its
 * transaction, so both calls are held in `prisma.$transaction` (i.e. after
 * the pre-check, before any transaction work). Two release orders:
 *  - overlap: both continue together;
 *  - afterFirstCommit: the second continues only once the first has committed.
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { posOrderPostingService } from '../../modules/pos/services/pos-order-posting.service';
import { posPostingContextFromIds } from '../../modules/pos/services/pos-posting-context';
import type { PosPostingContext } from '../../modules/pos/types/pos.types';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = /test/i.test(dbName) ? describe : describe.skip;

const SEED_DATE = new Date('2026-01-02T00:00:00.000Z');
const SEED_QTY = 100;
const SEED_COST = 5;
const QTY = 10;
const PRICE = 20;
const TAX_PERCENT = 14;
// Net = 10 × 20 + 14% VAT = 228, split across all three tenders.
const TENDERS = { cashAmount: 100, cardAmount: 80, creditAmount: 48 };

/** The loser must be stopped by the order claim, not by some unrelated constraint. */
const NOT_POSTED = 'Order is not posted';

type OrderType = 'SALE' | 'RETURN';
type Mode = 'overlap' | 'afterFirstCommit';

const prisma = new PrismaClient();

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function raceUnpost(ctx: PosPostingContext, orderId: string, mode: Mode) {
  const client = sharedPrisma as unknown as { $transaction: (...args: unknown[]) => unknown };
  const original = client.$transaction;
  let arrived = 0;
  let bothArrived!: () => void;
  const bothHere = new Promise<void>((r) => (bothArrived = r));
  let firstSettled!: () => void;
  const firstDone = new Promise<void>((r) => (firstSettled = r));

  const spy = jest.spyOn(client, '$transaction').mockImplementation(async (...args: unknown[]) => {
    const order = ++arrived;
    if (arrived >= 2) bothArrived();
    await Promise.race([bothHere, wait(5_000)]);
    if (mode === 'afterFirstCommit' && order === 2) {
      await Promise.race([firstDone, wait(30_000)]);
    }
    return original.apply(sharedPrisma, args);
  });

  try {
    const run = () =>
      posOrderPostingService.unpostOrder(ctx, orderId).finally(() => firstSettled());
    const results = await Promise.allSettled([run(), run()]);
    return {
      arrived,
      fulfilled: results.filter((r) => r.status === 'fulfilled').length,
      rejected: results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason))),
    };
  } finally {
    spy.mockRestore();
  }
}

describeDb('CC-03 POS order unpost concurrency (real MySQL)', () => {
  jest.setTimeout(180_000);

  let companyId: string;
  let branchId: string;
  let fiscalYearId: string;
  let warehouseId: string;
  let unitId: string;
  let bankId: string;
  let arAccountId: string;
  let ctx: PosPostingContext;
  let seq = 0;

  const suffix = String(Date.now());
  const nextCode = (prefix: string) => `${prefix}${suffix.slice(-7)}${++seq}`;

  async function account(code: string, arabicName: string, accountType: string) {
    return prisma.account.create({
      data: { companyId, code, arabicName, accountType, isActive: true },
    });
  }

  /** Fresh item, customer, drawer, bank, terminal and open shift per case. */
  async function scenario() {
    const item = await prisma.item.create({
      data: { companyId, arabicName: `CC03 Item ${nextCode('I')}` },
    });
    await prisma.itemUnit.create({ data: { itemId: item.id, unitId } });
    await sharedPrisma.$transaction((tx) =>
      inventoryCostingService.applyInboundMovement(tx, {
        companyId,
        branchId,
        itemId: item.id,
        warehouseId,
        quantity: SEED_QTY,
        unitCost: SEED_COST,
        movementType: COSTING_MOVEMENT.PURCHASE,
        sourceType: 'CC03-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: SEED_DATE,
        updateLastPurchasePrice: false,
      })
    );
    // COGS now comes from the costing snapshot written by the seed inbound above.
    // The history row is leftover fixture data and is not the POS cost source.
    await prisma.itemCostHistory.create({
      data: {
        companyId,
        branchId,
        itemId: item.id,
        serial: 1,
        cost: SEED_COST,
        effectiveAt: SEED_DATE,
        documentDate: SEED_DATE,
        sourceType: 'CC03-SEED',
        sourceNumber: item.id.slice(0, 8),
        sourceYearId: '2026',
      },
    });

    const cashGl = await account(nextCode('11'), 'CC03 Drawer GL', 'asset');
    const bankGl = await account(nextCode('12'), 'CC03 Bank GL', 'asset');
    const safe = await prisma.safe.create({
      data: {
        companyId,
        code: nextCode('S'),
        arabicName: 'CC03 Drawer',
        currencyCode: 'EGP',
        glAccountId: cashGl.id,
      },
    });
    const bank = await prisma.bankAccount.create({
      data: {
        companyId,
        bankId,
        code: nextCode('B'),
        arabicName: 'CC03 Bank',
        currencyCode: 'EGP',
        glAccountId: bankGl.id,
      },
    });
    const customer = await prisma.customer.create({
      data: { companyId, arabicName: `CC03 Customer ${nextCode('C')}`, creditLimit: 1_000_000 },
    });
    const terminal = await prisma.posTerminal.create({
      data: {
        companyId,
        branchId,
        warehouseId,
        safeId: safe.id,
        bankAccountId: bank.id,
        name: `CC03 Terminal ${nextCode('T')}`,
      },
    });
    const shift = await prisma.posShift.create({
      data: { companyId, branchId, fiscalYearId, terminalId: terminal.id, userId: 'cc03-cashier' },
    });
    return {
      itemId: item.id,
      customerId: customer.id,
      safeId: safe.id,
      bankAccountId: bank.id,
      cashGlId: cashGl.id,
      bankGlId: bankGl.id,
      shiftId: shift.id,
    };
  }

  type Scenario = Awaited<ReturnType<typeof scenario>>;

  async function createOrder(s: Scenario, orderType: OrderType) {
    const order = await posOrderPostingService.createOrder(companyId, s.shiftId, {
      orderNumber: nextCode(orderType === 'SALE' ? 'PS' : 'PR'),
      orderType,
      customerId: s.customerId,
      paymentMethod: 'SPLIT',
      ...TENDERS,
      lines: [
        { itemId: s.itemId, unitId, quantity: QTY, price: PRICE, taxPercent: TAX_PERCENT, lineOrder: 1 },
      ],
    });
    return { id: order!.id, orderNumber: order!.orderNumber };
  }

  async function glNet(where: { accountId: string; partnerId?: string }) {
    const sum = await prisma.journalEntryLine.aggregate({
      where: { ...where, journalEntry: { companyId, isPosted: true, deletedAt: null } },
      _sum: { debitBase: true, creditBase: true },
    });
    return Number(sum._sum.debitBase ?? 0) - Number(sum._sum.creditBase ?? 0);
  }

  /** Every cache POS touches, next to the ledger figure it must agree with. */
  async function balances(s: Scenario) {
    const [onHand, safe, bank, customer, shift] = await Promise.all([
      prisma.itemWarehouseBalance.findUnique({
        where: { companyId_itemId_warehouseId: { companyId, itemId: s.itemId, warehouseId } },
      }),
      prisma.safe.findUniqueOrThrow({ where: { id: s.safeId } }),
      prisma.bankAccount.findUniqueOrThrow({ where: { id: s.bankAccountId } }),
      prisma.customer.findUniqueOrThrow({ where: { id: s.customerId } }),
      prisma.posShift.findUniqueOrThrow({ where: { id: s.shiftId } }),
    ]);
    return {
      onHand: Number(onHand?.quantityOnHand ?? 0),
      safe: Number(safe.balance),
      safeGl: await glNet({ accountId: s.cashGlId }),
      bank: Number(bank.balance),
      bankGl: await glNet({ accountId: s.bankGlId }),
      customer: Number(customer.balance),
      customerGl: await glNet({ accountId: arAccountId, partnerId: s.customerId }),
      shift: {
        cash: Number(shift.totalCashSales),
        card: Number(shift.totalCardSales),
        credit: Number(shift.totalCreditSales),
        merchandise: Number(shift.totalMerchandise),
        tax: Number(shift.totalTaxAmount),
        cogs: Number(shift.totalCogs),
      },
    };
  }

  async function documentState(order: { id: string; orderNumber: string }) {
    const row = await prisma.posOrder.findUniqueOrThrow({ where: { id: order.id } });
    // POS journals carry the order number as sourceNumber (sourceType is not stored).
    const journals = await prisma.journalEntry.findMany({
      where: { companyId, sourceNumber: order.orderNumber, reversalOfJournalEntryId: null },
      select: { id: true },
    });
    return {
      status: row.status,
      movements: await prisma.inventoryMovement.count({
        where: { companyId, sourceType: 'POS', sourceNumber: order.orderNumber },
      }),
      journals: journals.length,
      reversals: await prisma.journalEntry.count({
        where: { companyId, reversalOfJournalEntryId: { in: journals.map((j) => j.id) } },
      }),
    };
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { arabicName: `CC03 POS ${suffix}`, englishName: `CC03 ${suffix}`, isActive: true },
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { companyId, arabicName: `CC03 Branch ${suffix}` },
    });
    branchId = branch.id;

    const fy = await prisma.fiscalYear.create({
      data: {
        companyId,
        legacyYearId: '2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
        status: 'Open',
        isActive: true,
      },
    });
    fiscalYearId = fy.id;

    arAccountId = (await account('1200', 'CC03 AR', 'asset')).id;
    await account('1300', 'CC03 Inventory', 'asset');
    await account('2300', 'CC03 VAT Output', 'liability');
    await account('4100', 'CC03 Sales', 'revenue');
    await account('5100', 'CC03 COGS', 'expense');

    await prisma.companySettings.create({
      data: {
        companyId,
        accountDefinitions: {
          arAccount: '1200',
          inventoryAccount: '1300',
          vatOutputAccount: '2300',
          salesRevenueAccount: '4100',
          cogsAccount: '5100',
        },
        allowNegativeBalance: true,
      },
    });

    warehouseId = (
      await prisma.warehouse.create({ data: { companyId, arabicName: `CC03 WH ${suffix}` } })
    ).id;
    unitId = (
      await prisma.unit.create({ data: { companyId, arabicName: 'CC03 Unit', code: `U${suffix}` } })
    ).id;
    bankId = (await prisma.bank.create({ data: { companyId, arabicName: 'CC03 Bank' } })).id;

    ctx = posPostingContextFromIds({ companyId, branchId, fiscalYearId, userId: 'cc03-pos-test' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  it('SALE (cash + card + credit): a single unpost reverses every effect once', async () => {
    const s = await scenario();
    const order = await createOrder(s, 'SALE');
    const initial = await balances(s);

    await posOrderPostingService.postOrder(ctx, order.id);
    const posted = { ...(await documentState(order)), ...(await balances(s)) };

    await posOrderPostingService.unpostOrder(ctx, order.id);
    const after = { ...(await documentState(order)), ...(await balances(s)) };

    console.log('[CC-03] SALE single', JSON.stringify({ initial, posted, after }));

    expect(posted).toMatchObject({
      status: 'POSTED',
      movements: 1,
      journals: 1,
      reversals: 0,
      onHand: SEED_QTY - QTY,
      safe: TENDERS.cashAmount,
      safeGl: TENDERS.cashAmount,
      bank: TENDERS.cardAmount,
      bankGl: TENDERS.cardAmount,
      customer: TENDERS.creditAmount,
      customerGl: TENDERS.creditAmount,
      shift: { cash: 100, card: 80, credit: 48, merchandise: 200, tax: 28, cogs: 50 },
    });
    expect(after).toEqual({ status: 'DRAFT', movements: 2, journals: 1, reversals: 0, ...initial });
  });

  it.each<[OrderType, Mode]>([
    ['SALE', 'overlap'],
    ['SALE', 'afterFirstCommit'],
    ['RETURN', 'afterFirstCommit'],
  ])('%s: two unposts (%s) reverse every effect exactly once', async (orderType, mode) => {
    const s = await scenario();
    let order: { id: string; orderNumber: string };
    let initial: Awaited<ReturnType<typeof balances>>;
    if (orderType === 'RETURN') {
      const sale = await createOrder(s, 'SALE');
      await posOrderPostingService.postOrder(ctx, sale.id);
      const saleLine = await prisma.posOrderLine.findFirstOrThrow({ where: { orderId: sale.id } });
      const draft = await posOrderPostingService.createReturn(ctx, {
        shiftId: s.shiftId,
        originalOrderId: sale.id,
        lines: [{ originalLineId: saleLine.id, quantity: QTY }],
      });
      order = { id: draft!.id, orderNumber: draft!.orderNumber };
      initial = await balances(s);
      await posOrderPostingService.postOrder(ctx, order.id, [
        { method: 'CASH', amount: TENDERS.cashAmount, safeId: s.safeId },
        { method: 'CARD', amount: TENDERS.cardAmount, bankAccountId: s.bankAccountId },
        { method: 'CREDIT', amount: TENDERS.creditAmount },
      ]);
    } else {
      order = await createOrder(s, 'SALE');
      initial = await balances(s);
      await posOrderPostingService.postOrder(ctx, order.id);
    }
    const posted = { ...(await documentState(order)), ...(await balances(s)) };

    const outcome = await raceUnpost(ctx, order.id, mode);
    const after = { ...(await documentState(order)), ...(await balances(s)) };

    console.log(`[CC-03] ${orderType} ${mode}`, JSON.stringify({ initial, posted, outcome, after }));

    expect(outcome.arrived).toBe(2);
    expect({ fulfilled: outcome.fulfilled, rejected: outcome.rejected }).toEqual({
      fulfilled: 1,
      rejected: [NOT_POSTED],
    });
    expect(after).toEqual({ status: 'DRAFT', movements: 2, journals: 1, reversals: 0, ...initial });
  });

  it('SALE: post → unpost → repost → unpost applies and reverses once per cycle', async () => {
    const s = await scenario();
    const order = await createOrder(s, 'SALE');
    const initial = await balances(s);

    await posOrderPostingService.postOrder(ctx, order.id);
    const postedBalances = await balances(s);

    await posOrderPostingService.unpostOrder(ctx, order.id);
    expect(await documentState(order)).toEqual({
      status: 'DRAFT',
      movements: 2,
      journals: 1,
      reversals: 0,
    });
    expect(await balances(s)).toEqual(initial);

    await posOrderPostingService.postOrder(ctx, order.id);
    expect(await documentState(order)).toEqual({
      status: 'POSTED',
      movements: 3,
      journals: 2,
      reversals: 0,
    });
    expect(await balances(s)).toEqual(postedBalances);

    await posOrderPostingService.unpostOrder(ctx, order.id);
    expect(await documentState(order)).toEqual({
      status: 'DRAFT',
      movements: 4,
      journals: 2,
      reversals: 0,
    });
    expect(await balances(s)).toEqual(initial);
  });
});
