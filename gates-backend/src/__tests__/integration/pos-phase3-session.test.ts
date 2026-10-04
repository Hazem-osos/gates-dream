/**
 * Phase 3 returns, drawer movements, and counted close.
 * Needs a MySQL database whose name contains "test".
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { posOrderPostingService } from '../../modules/pos/services/pos-order-posting.service';
import { posShiftService } from '../../modules/pos/services/pos-shift.service';
import { posCashMovementService } from '../../modules/pos/services/pos-cash-movement.service';
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
const prisma = new PrismaClient();

describeDb('POS phase 3 session (real MySQL)', () => {
  jest.setTimeout(180_000);
  const suffix = String(Date.now());
  let seq = 0;
  const nextCode = (prefix: string) => `${prefix}${suffix.slice(-6)}${++seq}`;

  let companyId: string;
  let branchId: string;
  let fiscalYearId: string;
  let warehouseId: string;
  let unitId: string;
  let ctx: PosPostingContext;
  let terminalId: string;
  let safeId: string;
  let customerId: string;
  let contraId: string;
  let shiftId: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `P3 ${suffix}`, isActive: true } })).id;
    branchId = (await prisma.branch.create({ data: { companyId, arabicName: `P3 Branch ${suffix}` } })).id;
    fiscalYearId = (
      await prisma.fiscalYear.create({
        data: {
          companyId,
          legacyYearId: '2026',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'Open',
          isActive: true,
        },
      })
    ).id;
    const account = (code: string, arabicName: string, accountType: string) =>
      prisma.account.create({ data: { companyId, code, arabicName, accountType, isActive: true } });
    await account('1200', 'P3 AR', 'asset');
    await account('1300', 'P3 Inventory', 'asset');
    await account('2300', 'P3 VAT', 'liability');
    await account('4100', 'P3 Sales', 'revenue');
    await account('5100', 'P3 COGS', 'expense');
    const cashGl = await account(nextCode('11'), 'P3 Drawer', 'asset');
    contraId = (await account(nextCode('21'), 'P3 Contra', 'liability')).id;
    warehouseId = (await prisma.warehouse.create({ data: { companyId, arabicName: `P3 WH ${suffix}` } })).id;
    unitId = (await prisma.unit.create({ data: { companyId, arabicName: 'P3 Unit', code: `U${suffix}` } })).id;
    safeId = (
      await prisma.safe.create({
        data: { companyId, code: nextCode('S'), arabicName: 'P3 Safe', currencyCode: 'EGP', glAccountId: cashGl.id },
      })
    ).id;
    customerId = (
      await prisma.customer.create({ data: { companyId, arabicName: `P3 Customer ${suffix}`, creditLimit: 500 } })
    ).id;
    terminalId = (
      await prisma.posTerminal.create({
        data: { companyId, branchId, warehouseId, safeId, defaultCustomerId: customerId, name: `P3 Terminal ${suffix}` },
      })
    ).id;
    await prisma.companySettings.create({
      data: {
        companyId,
        allowNegativeBalance: true,
        accountDefinitions: {
          arAccount: '1200',
          inventoryAccount: '1300',
          vatOutputAccount: '2300',
          salesRevenueAccount: '4100',
          cogsAccount: '5100',
        },
      },
    });
    ctx = posPostingContextFromIds({ companyId, branchId, fiscalYearId, userId: 'p3-cashier' });
    shiftId = (await posShiftService.openShift(ctx, { terminalId, openingCash: 100 })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  async function stocked(price = 10) {
    const item = await prisma.item.create({
      data: { companyId, arabicName: `P3 Item ${nextCode('I')}`, priceRetail: price, defaultTaxPercent: 0 },
    });
    await prisma.itemUnit.create({ data: { itemId: item.id, unitId, isBaseUnit: true } });
    await sharedPrisma.$transaction((tx) =>
      inventoryCostingService.applyInboundMovement(tx, {
        companyId,
        branchId,
        itemId: item.id,
        warehouseId,
        quantity: 20,
        unitCost: 4,
        movementType: COSTING_MOVEMENT.PURCHASE,
        sourceType: 'P3-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: new Date('2026-01-02'),
        updateLastPurchasePrice: false,
      })
    );
    return item;
  }

  async function sellOn(targetShiftId: string, targetSafeId: string, itemId: string) {
    const draft = await posOrderPostingService.createOrder(
      companyId,
      targetShiftId,
      {
        orderNumber: nextCode('PO'),
        customerId,
        lines: [{ itemId, unitId, quantity: 1, price: 10, lineOrder: 1 }],
      },
      { paymentsDeferred: true }
    );
    return posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CASH', amount: 10, safeId: targetSafeId },
    ]);
  }

  async function sell(itemId: string, quantity: number, payments: Array<{ method: 'CASH' | 'CARD' | 'CREDIT'; amount: number }>) {
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      {
        orderNumber: nextCode('PO'),
        customerId,
        lines: [{ itemId, unitId, quantity, price: 10, lineOrder: 1 }],
      },
      { paymentsDeferred: true }
    );
    return posOrderPostingService.postOrder(
      ctx,
      draft!.id,
      payments.map((row) => ({ ...row, safeId, tenderedAmount: row.method === 'CASH' ? row.amount : undefined }))
    );
  }

  async function enableVarianceAccounts() {
    await prisma.account.create({ data: { companyId, code: '6100', arabicName: 'P3 Shortage', accountType: 'expense', isActive: true } });
    await prisma.account.create({ data: { companyId, code: '4200', arabicName: 'P3 Surplus', accountType: 'revenue', isActive: true } });
    await prisma.companySettings.update({
      where: { companyId },
      data: {
        accountDefinitions: {
          arAccount: '1200',
          inventoryAccount: '1300',
          vatOutputAccount: '2300',
          salesRevenueAccount: '4100',
          cogsAccount: '5100',
          cashShortageAccount: '6100',
          cashSurplusAccount: '4200',
        },
      },
    });
  }

  it('returns part of a sale, rejects the remainder overflow, and restores stock once', async () => {
    const item = await stocked();
    const sale = await sell(item.id, 4, [{ method: 'CASH', amount: 40 }]);
    const originalNet = Number(sale.netAmount);
    const lineId = sale.lines[0].id;
    const first = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: lineId, quantity: 1 }],
    });
    const posted = await posOrderPostingService.postOrder(ctx, first!.id, [
      { method: 'CASH', amount: Number(first!.netAmount), tenderedAmount: Number(first!.netAmount), safeId },
    ]);
    const second = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: lineId, quantity: 2 }],
    });
    await posOrderPostingService.postOrder(ctx, second!.id, [
      { method: 'CASH', amount: Number(second!.netAmount), safeId },
    ]);
    const overflow = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: lineId, quantity: 2 }],
    });
    await expect(
      posOrderPostingService.postOrder(ctx, overflow!.id, [{ method: 'CASH', amount: Number(overflow!.netAmount), safeId }])
    ).rejects.toThrow('Returned quantity exceeds the quantity sold');
    const original = await prisma.posOrder.findUniqueOrThrow({ where: { id: sale.id } });
    expect(original.status).toBe('POSTED');
    expect(Number(original.netAmount)).toBe(originalNet);
    expect(await prisma.inventoryMovement.count({ where: { sourceDocumentId: posted.id, movementType: 'POS-RETURN' } })).toBe(1);
    const onHand = await prisma.itemWarehouseBalance.findFirstOrThrow({ where: { itemId: item.id, warehouseId } });
    expect(Number(onHand.quantityOnHand)).toBe(19);
  });

  it('rejects two full returns that race', async () => {
    const item = await stocked();
    const sale = await sell(item.id, 2, [{ method: 'CASH', amount: 20 }]);
    const lineId = sale.lines[0].id;
    const a = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: lineId, quantity: 2 }],
    });
    const b = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: lineId, quantity: 2 }],
    });
    const results = await Promise.allSettled([
      posOrderPostingService.postOrder(ctx, a!.id, [{ method: 'CASH', amount: 20, safeId }]),
      posOrderPostingService.postOrder(ctx, b!.id, [{ method: 'CASH', amount: 20, safeId }]),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1);
    const returns = await prisma.posOrder.count({
      where: { originalOrderId: sale.id, status: 'POSTED', orderType: 'RETURN' },
    });
    expect(returns).toBe(1);
    const onHand = await prisma.itemWarehouseBalance.findFirstOrThrow({ where: { itemId: item.id, warehouseId } });
    expect(Number(onHand.quantityOnHand)).toBe(20);
  });

  it('refunds credit against the customer cache and can return on a later session', async () => {
    const item = await stocked();
    const sale = await sell(item.id, 1, [{ method: 'CREDIT', amount: 10 }]);
    expect(Number((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).balance)).toBe(10);
    const journalsBefore = await prisma.journalEntry.count({ where: { companyId, sourceNumber: sale.orderNumber } });
    const preview = await posShiftService.reconciliation(companyId, shiftId);
    await posShiftService.closeShift(ctx, shiftId, preview.equation.expectedCash);
    const closedTotals = await prisma.posShift.findUniqueOrThrow({ where: { id: shiftId } });
    const closedSnapshot = await prisma.posShiftClose.findFirstOrThrow({
      where: { shiftId: closedTotals.id, reopenedAt: null },
    });
    shiftId = (await posShiftService.openShift(ctx, { terminalId, openingCash: 50 })).id;
    const draft = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: sale.lines[0].id, quantity: 1 }],
    });
    const returned = await posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CREDIT', amount: Number(draft!.netAmount) },
    ]);
    expect(returned.shiftId).toBe(shiftId);
    expect(returned.shiftId).not.toBe(closedTotals.id);
    const original = await prisma.posOrder.findUniqueOrThrow({ where: { id: sale.id } });
    expect(original.status).toBe('POSTED');
    expect(Number((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).balance)).toBe(0);
    expect(await prisma.journalEntry.count({ where: { companyId, sourceNumber: sale.orderNumber } })).toBe(journalsBefore);
    expect(await prisma.journalEntry.count({ where: { id: returned.journalEntryId! } })).toBe(1);
    const snapshot = await prisma.posShiftClose.findFirstOrThrow({ where: { shiftId: closedTotals.id, reopenedAt: null } });
    expect(Number(snapshot.expectedCash)).toBe(Number(closedSnapshot.expectedCash));
    expect(snapshot.reopenedAt).toBeNull();
  });

  it('records cash in and cash out in the expected drawer equation', async () => {
    const before = await posShiftService.reconciliation(companyId, shiftId);
    await posCashMovementService.record(ctx, { shiftId, type: 'CASH_IN', amount: 30, reason: 'عهدة', contraAccountId: contraId });
    await posCashMovementService.record(ctx, { shiftId, type: 'CASH_OUT', amount: 5, reason: 'مصروف', contraAccountId: contraId });
    const after = await posShiftService.reconciliation(companyId, shiftId);
    expect(after.equation.cashIn).toBe(before.equation.cashIn + 30);
    expect(after.equation.cashOut).toBe(before.equation.cashOut + 5);
    expect(after.equation.expectedCash).toBe(before.equation.expectedCash + 25);
    const movement = await prisma.posCashMovement.findFirstOrThrow({ where: { shiftId, type: 'CASH_IN' } });
    const cashLine = await prisma.journalEntryLine.findFirstOrThrow({
      where: { journalEntryId: movement.journalEntryId!, description: 'POS cash in' },
    });
    expect(Number(cashLine.debit)).toBe(30);
    expect(await prisma.posOrder.count({ where: { companyId, notes: 'عهدة' } })).toBe(0);
  });

  it('blocks a shortage close until the variance account exists, then posts shortage and overage', async () => {
    const preview = await posShiftService.reconciliation(companyId, shiftId);
    await expect(posShiftService.closeShift(ctx, shiftId, preview.equation.expectedCash - 4)).rejects.toThrow(
      'Cash shortage account is not configured'
    );
    expect((await prisma.posShift.findUniqueOrThrow({ where: { id: shiftId } })).status).toBe('OPEN');
    await enableVarianceAccounts();
    const short = await posShiftService.closeShift(ctx, shiftId, preview.equation.expectedCash - 4);
    expect(Number(short.snapshot?.variance)).toBe(-4);
    expect(short.journalEntryId).toBeTruthy();
    const shortageLine = await prisma.journalEntryLine.findFirstOrThrow({
      where: { journalEntryId: short.journalEntryId!, description: 'Cash shortage' },
    });
    expect(Number(shortageLine.debit)).toBe(4);
    await posShiftService.reopenShift(ctx, shiftId);
    const reopened = await prisma.posShiftClose.findFirstOrThrow({ where: { id: short.snapshot!.id } });
    expect(reopened.reopenedAt).toBeTruthy();
    const journal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: short.journalEntryId! } });
    expect(journal.isPosted).toBe(false);
    const again = await posShiftService.closeShift(ctx, shiftId, preview.equation.expectedCash + 3);
    expect(Number(again.snapshot?.variance)).toBe(3);
    expect(again.journalEntryId).not.toBe(short.journalEntryId);
    const oldJournal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: short.journalEntryId! } });
    const newJournal = await prisma.journalEntry.findUniqueOrThrow({ where: { id: again.journalEntryId! } });
    expect(oldJournal.isPosted).toBe(false);
    expect(newJournal.isPosted).toBe(true);
    expect(newJournal.entryType).toBe('POS-Z');
    expect((await prisma.posShift.findUniqueOrThrow({ where: { id: shiftId } })).status).toBe('CLOSED');
  });

  it('treats a repeated close as the same snapshot and rejects a different count', async () => {
    const closed = await prisma.posShift.findUniqueOrThrow({ where: { id: shiftId } });
    const repeat = await posShiftService.closeShift(ctx, shiftId, Number(closed.closingCashDeclared));
    expect(repeat.journalEntryId).toBe(closed.endOfDayJournalEntryId);
    await expect(posShiftService.closeShift(ctx, shiftId, Number(closed.closingCashDeclared) + 1)).rejects.toThrow(
      'Shift is already closed'
    );
  });

  async function freshShift(openingCash: number) {
    const cashGl = await prisma.account.create({
      data: { companyId, code: nextCode('11'), arabicName: `P3 Race ${seq}`, accountType: 'asset', isActive: true },
    });
    const safe = await prisma.safe.create({
      data: { companyId, code: nextCode('S'), arabicName: `P3 Race Safe ${seq}`, currencyCode: 'EGP', glAccountId: cashGl.id },
    });
    const terminal = await prisma.posTerminal.create({
      data: { companyId, branchId, warehouseId, safeId: safe.id, name: `P3 Race ${suffix}-${seq}` },
    });
    const open = await posShiftService.openShift(ctx, { terminalId: terminal.id, openingCash });
    return { safeId: safe.id, shiftId: open.id, terminalId: terminal.id };
  }

  it('does not post a sale onto a session whose close already committed', async () => {
    const open = await freshShift(0);
    const item = await stocked();
    const draft = await posOrderPostingService.createOrder(
      companyId,
      open.shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, price: 10, lineOrder: 1 }] },
      { paymentsDeferred: true }
    );
    await Promise.allSettled([
      posOrderPostingService.postOrder(ctx, draft!.id, [{ method: 'CASH', amount: 10, safeId: open.safeId }]),
      posShiftService.closeShift(ctx, open.shiftId, 0),
    ]);
    const shift = await prisma.posShift.findUniqueOrThrow({ where: { id: open.shiftId } });
    const order = await prisma.posOrder.findUniqueOrThrow({ where: { id: draft!.id } });
    if (shift.status === 'CLOSED' && order.status === 'POSTED') {
      const snapshot = await prisma.posShiftClose.findFirstOrThrow({ where: { shiftId: open.shiftId, reopenedAt: null } });
      expect(Number(snapshot.cashSales)).toBe(10);
    } else if (shift.status === 'CLOSED') {
      expect(order.status).toBe('DRAFT');
    } else {
      expect(order.status).toBe('POSTED');
    }
    const postedOnClosedWithoutCash = await prisma.posOrder.count({
      where: { id: draft!.id, status: 'POSTED', shift: { status: 'CLOSED', closes: { none: { cashSales: { gt: 0 } } } } },
    });
    expect(postedOnClosedWithoutCash).toBe(0);
  });

  it('does not post a return onto a session whose close already committed', async () => {
    const saleShift = await freshShift(0);
    const item = await stocked();
    const sale = await sellOn(saleShift.shiftId, saleShift.safeId, item.id);
    await posShiftService.closeShift(ctx, saleShift.shiftId, 10);
    const open = await freshShift(0);
    const line = await prisma.posOrderLine.findFirstOrThrow({ where: { orderId: sale.id } });
    const ret = await posOrderPostingService.createReturn(ctx, {
      shiftId: open.shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: line.id, quantity: 1 }],
    });
    await Promise.allSettled([
      posOrderPostingService.postOrder(ctx, ret!.id, [{ method: 'CASH', amount: 10, safeId: open.safeId }]),
      posShiftService.closeShift(ctx, open.shiftId, 0),
    ]);
    const shift = await prisma.posShift.findUniqueOrThrow({ where: { id: open.shiftId } });
    const order = await prisma.posOrder.findUniqueOrThrow({ where: { id: ret!.id } });
    if (shift.status === 'CLOSED' && order.status === 'POSTED') {
      const snapshot = await prisma.posShiftClose.findFirstOrThrow({ where: { shiftId: open.shiftId, reopenedAt: null } });
      expect(Number(snapshot.cashRefunds)).toBe(10);
      expect(Number(snapshot.expectedCash)).toBe(-10);
    } else if (shift.status === 'CLOSED') {
      expect(order.status).toBe('DRAFT');
      const snapshot = await prisma.posShiftClose.findFirstOrThrow({ where: { shiftId: open.shiftId, reopenedAt: null } });
      expect(Number(snapshot.cashRefunds)).toBe(0);
    } else {
      expect(order.status).toBe('POSTED');
    }
  });

  it('does not record a cash movement on a session whose close already committed', async () => {
    const open = await freshShift(0);
    await Promise.allSettled([
      posCashMovementService.record(ctx, {
        shiftId: open.shiftId,
        type: 'CASH_IN',
        amount: 7,
        reason: 'سباق',
        contraAccountId: contraId,
      }),
      posShiftService.closeShift(ctx, open.shiftId, 0),
    ]);
    const shift = await prisma.posShift.findUniqueOrThrow({ where: { id: open.shiftId } });
    const movements = await prisma.posCashMovement.count({ where: { shiftId: open.shiftId } });
    expect(movements).toBeLessThanOrEqual(1);
    if (shift.status === 'CLOSED') {
      const snapshot = await prisma.posShiftClose.findFirstOrThrow({ where: { shiftId: open.shiftId, reopenedAt: null } });
      expect(Number(snapshot.cashIn)).toBe(movements === 1 ? 7 : 0);
    } else {
      expect(movements).toBe(1);
    }
  });

  it('rejects a manually constructed return that is not linked to a posted sale', async () => {
    const open = await freshShift(0);
    const item = await stocked();
    const draft = await posOrderPostingService.createOrder(
      companyId,
      open.shiftId,
      {
        orderNumber: nextCode('PR'),
        orderType: 'RETURN',
        customerId,
        lines: [{ itemId: item.id, unitId, quantity: 1, price: 99, taxPercent: 14, lineOrder: 1 }],
      },
      { paymentsDeferred: true }
    );
    await expect(
      posOrderPostingService.postOrder(ctx, draft!.id, [{ method: 'CASH', amount: 99, safeId: open.safeId }])
    ).rejects.toThrow('POS return requires a posted original sale');
    expect((await prisma.posOrder.findUniqueOrThrow({ where: { id: draft!.id } })).status).toBe('DRAFT');
    expect(await prisma.inventoryMovement.count({ where: { companyId, sourceNumber: draft!.orderNumber } })).toBe(0);
  });

  it('rejects a fake original line, a line from another sale, another company, a return, or a different item', async () => {
    const open = await freshShift(0);
    const item = await stocked();
    const otherItem = await stocked();
    const sale = await sellOn(open.shiftId, open.safeId, item.id);
    const otherSale = await sellOn(open.shiftId, open.safeId, otherItem.id);
    const saleLine = await prisma.posOrderLine.findFirstOrThrow({ where: { orderId: sale.id } });
    const otherLine = await prisma.posOrderLine.findFirstOrThrow({ where: { orderId: otherSale.id } });

    const linked = async () => {
      const draft = await posOrderPostingService.createReturn(ctx, {
        shiftId: open.shiftId,
        originalOrderId: sale.id,
        lines: [{ originalLineId: saleLine.id, quantity: 1 }],
      });
      return draft!;
    };

    const fake = await linked();
    await expect(
      prisma.posOrderLine.update({
        where: { id: fake.lines[0].id },
        data: { originalLineId: '00000000-0000-4000-8000-000000000000' },
      })
    ).rejects.toThrow();
    expect((await prisma.posOrder.findUniqueOrThrow({ where: { id: fake.id } })).status).toBe('DRAFT');

    const wrongOrder = await linked();
    await prisma.posOrderLine.update({
      where: { id: wrongOrder.lines[0].id },
      data: { originalLineId: otherLine.id },
    });
    await expect(
      posOrderPostingService.postOrder(ctx, wrongOrder.id, [{ method: 'CASH', amount: 10, safeId: open.safeId }])
    ).rejects.toThrow('POS return line must reference the original sold line');
    expect((await prisma.posOrder.findUniqueOrThrow({ where: { id: wrongOrder.id } })).status).toBe('DRAFT');

    const otherCompanyId = (await prisma.company.create({ data: { arabicName: `P3 Other ${nextCode('C')}`, isActive: true } })).id;
    const otherBranchId = (await prisma.branch.create({ data: { companyId: otherCompanyId, arabicName: 'P3 Other Branch' } })).id;
    const otherWarehouseId = (await prisma.warehouse.create({ data: { companyId: otherCompanyId, arabicName: 'P3 Other WH' } })).id;
    const otherGl = await prisma.account.create({
      data: { companyId: otherCompanyId, code: nextCode('11'), arabicName: 'P3 Other Drawer', accountType: 'asset', isActive: true },
    });
    const otherSafe = await prisma.safe.create({
      data: { companyId: otherCompanyId, code: nextCode('S'), arabicName: 'P3 Other Safe', currencyCode: 'EGP', glAccountId: otherGl.id },
    });
    const otherTerminal = await prisma.posTerminal.create({
      data: { companyId: otherCompanyId, branchId: otherBranchId, warehouseId: otherWarehouseId, safeId: otherSafe.id, name: `P3 Other ${suffix}` },
    });
    const otherShift = await prisma.posShift.create({
      data: { companyId: otherCompanyId, branchId: otherBranchId, terminalId: otherTerminal.id, userId: 'p3-other', status: 'CLOSED' },
    });
    const foreignSale = await prisma.posOrder.create({
      data: {
        companyId: otherCompanyId,
        shiftId: otherShift.id,
        orderNumber: nextCode('FX'),
        orderType: 'SALE',
        status: 'POSTED',
        paymentMethod: 'CASH',
        netAmount: 10,
        totalAmount: 10,
      },
    });
    const foreignLine = await prisma.posOrderLine.create({
      data: {
        orderId: foreignSale.id,
        itemId: item.id,
        unitId,
        quantity: 1,
        price: 10,
        lineTotal: 10,
        lineOrder: 1,
      },
    });
    const foreign = await linked();
    await prisma.posOrder.update({ where: { id: foreign.id }, data: { originalOrderId: foreignSale.id } });
    await prisma.posOrderLine.update({ where: { id: foreign.lines[0].id }, data: { originalLineId: foreignLine.id } });
    await expect(
      posOrderPostingService.postOrder(ctx, foreign.id, [{ method: 'CASH', amount: 10, safeId: open.safeId }])
    ).rejects.toThrow('POS return requires a posted original sale');
    expect((await prisma.posOrder.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe('DRAFT');

    const postedReturn = await posOrderPostingService.createReturn(ctx, {
      shiftId: open.shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: saleLine.id, quantity: 1 }],
    });
    await posOrderPostingService.postOrder(ctx, postedReturn!.id, [{ method: 'CASH', amount: 10, safeId: open.safeId }]);
    const returnLine = await prisma.posOrderLine.findFirstOrThrow({ where: { orderId: postedReturn!.id } });
    const nested = await posOrderPostingService.createOrder(
      companyId,
      open.shiftId,
      {
        orderNumber: nextCode('PR'),
        orderType: 'RETURN',
        originalOrderId: postedReturn!.id,
        lines: [{ itemId: item.id, unitId, quantity: 1, price: 10, lineOrder: 1, originalLineId: returnLine.id }],
      },
      { paymentsDeferred: true }
    );
    await expect(
      posOrderPostingService.postOrder(ctx, nested!.id, [{ method: 'CASH', amount: 10, safeId: open.safeId }])
    ).rejects.toThrow('POS return requires a posted original sale');
    expect((await prisma.posOrder.findUniqueOrThrow({ where: { id: nested!.id } })).status).toBe('DRAFT');

    const mismatched = await posOrderPostingService.createOrder(
      companyId,
      open.shiftId,
      {
        orderNumber: nextCode('PR'),
        orderType: 'RETURN',
        originalOrderId: otherSale.id,
        lines: [{ itemId: item.id, unitId, quantity: 1, price: 10, lineOrder: 1, originalLineId: otherLine.id }],
      },
      { paymentsDeferred: true }
    );
    await expect(
      posOrderPostingService.postOrder(ctx, mismatched!.id, [{ method: 'CASH', amount: 10, safeId: open.safeId }])
    ).rejects.toThrow('POS return item does not match the original sold line');
    expect((await prisma.posOrder.findUniqueOrThrow({ where: { id: mismatched!.id } })).status).toBe('DRAFT');
  });

  it('posts a linked return from the original sale even when the draft price and customer were changed', async () => {
    const open = await freshShift(0);
    const item = await stocked();
    const sale = await sellOn(open.shiftId, open.safeId, item.id);
    const saleLine = await prisma.posOrderLine.findFirstOrThrow({ where: { orderId: sale.id } });
    const imposter = await prisma.customer.create({ data: { companyId, arabicName: `P3 Imposter ${nextCode('C')}` } });
    const draft = await posOrderPostingService.createReturn(ctx, {
      shiftId: open.shiftId,
      originalOrderId: sale.id,
      lines: [{ originalLineId: saleLine.id, quantity: 1 }],
    });
    await prisma.posOrder.update({
      where: { id: draft!.id },
      data: { customerId: imposter.id, totalAmount: 1, taxAmount: 5, discountAmount: 2, netAmount: 4 },
    });
    await prisma.posOrderLine.update({
      where: { id: draft!.lines[0].id },
      data: { price: 1, taxPercent: 25, discountAmount: 2, taxAmount: 5, lineTotal: 4 },
    });
    const posted = await posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CASH', amount: 10, safeId: open.safeId },
    ]);
    const line = await prisma.posOrderLine.findFirstOrThrow({ where: { orderId: posted.id } });
    expect(posted.status).toBe('POSTED');
    expect(posted.customerId).toBe(customerId);
    expect(Number(posted.netAmount)).toBe(10);
    expect(Number(line.price)).toBe(10);
    expect(Number(line.taxAmount)).toBe(0);
    expect(Number(line.unitCost)).toBe(4);
    expect(line.originalLineId).toBe(saleLine.id);
    const original = await prisma.posOrder.findUniqueOrThrow({ where: { id: sale.id } });
    expect(original.status).toBe('POSTED');
    expect(Number(original.netAmount)).toBe(Number(sale.netAmount));
  });
});
