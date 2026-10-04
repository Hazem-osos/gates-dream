/**
 * Phase 1 POS correctness. Needs a MySQL database whose name contains "test".
 * Apply prisma migration 20260930180000_pos_one_open_shift before the session tests.
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import { posOrderPostingService } from '../../modules/pos/services/pos-order-posting.service';
import { posShiftService } from '../../modules/pos/services/pos-shift.service';
import { posService } from '../../modules/pos/services/pos.service';
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
const prisma = new PrismaClient();

describeDb('POS phase 1 foundation (real MySQL)', () => {
  jest.setTimeout(180_000);

  let companyId: string;
  let otherCompanyId: string;
  let branchId: string;
  let otherBranchId: string;
  let fiscalYearId: string;
  let warehouseId: string;
  let unitId: string;
  let ctx: PosPostingContext;
  let seq = 0;
  const suffix = String(Date.now());
  const nextCode = (prefix: string) => `${prefix}${suffix.slice(-6)}${++seq}`;

  async function account(ownerId: string, code: string, arabicName: string, accountType: string) {
    return prisma.account.create({
      data: { companyId: ownerId, code, arabicName, accountType, isActive: true },
    });
  }

  async function terminalFor(ownerId: string, ownerBranch: string, ownerWarehouse: string) {
    const cashGl = await account(ownerId, nextCode('11'), 'P1 Drawer GL', 'asset');
    const safe = await prisma.safe.create({
      data: {
        companyId: ownerId,
        code: nextCode('S'),
        arabicName: 'P1 Drawer',
        currencyCode: 'EGP',
        glAccountId: cashGl.id,
      },
    });
    const terminal = await prisma.posTerminal.create({
      data: {
        companyId: ownerId,
        branchId: ownerBranch,
        warehouseId: ownerWarehouse,
        safeId: safe.id,
        name: `P1 Terminal ${nextCode('T')}`,
      },
    });
    return { terminal, safeId: safe.id, cashGlId: cashGl.id };
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { arabicName: `P1 POS ${suffix}`, englishName: `P1 ${suffix}`, isActive: true },
    });
    companyId = company.id;
    const other = await prisma.company.create({
      data: { arabicName: `P1 Other ${suffix}`, englishName: `P1B ${suffix}`, isActive: true },
    });
    otherCompanyId = other.id;

    branchId = (await prisma.branch.create({ data: { companyId, arabicName: `P1 Branch ${suffix}` } })).id;
    otherBranchId = (
      await prisma.branch.create({ data: { companyId: otherCompanyId, arabicName: `P1B Branch ${suffix}` } })
    ).id;

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

    await account(companyId, '1200', 'P1 AR', 'asset');
    await account(companyId, '1300', 'P1 Inventory', 'asset');
    await account(companyId, '2300', 'P1 VAT', 'liability');
    await account(companyId, '4100', 'P1 Sales', 'revenue');
    await account(companyId, '5100', 'P1 COGS', 'expense');
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

    warehouseId = (await prisma.warehouse.create({ data: { companyId, arabicName: `P1 WH ${suffix}` } })).id;
    unitId = (await prisma.unit.create({ data: { companyId, arabicName: 'P1 Unit', code: `U${suffix}` } })).id;
    ctx = posPostingContextFromIds({ companyId, branchId, fiscalYearId, userId: 'p1-cashier' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  async function stockedItem() {
    const item = await prisma.item.create({ data: { companyId, arabicName: `P1 Item ${nextCode('I')}` } });
    await prisma.itemUnit.create({ data: { itemId: item.id, unitId } });
    await sharedPrisma.$transaction((tx) =>
      inventoryCostingService.applyInboundMovement(tx, {
        companyId,
        branchId,
        itemId: item.id,
        warehouseId,
        quantity: 20,
        unitCost: 5,
        movementType: COSTING_MOVEMENT.PURCHASE,
        sourceType: 'P1-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: SEED_DATE,
        updateLastPurchasePrice: false,
      })
    );
    return item.id;
  }

  async function openSession() {
    const { terminal } = await terminalFor(companyId, branchId, warehouseId);
    const shift = await posShiftService.openShift(ctx, { terminalId: terminal.id, openingCash: 0 });
    return { terminal, shift };
  }

  async function draftSale(shiftId: string, itemId: string, price = 10) {
    return posOrderPostingService.createOrder(companyId, shiftId, {
      orderNumber: nextCode('PO'),
      paymentMethod: 'CASH',
      cashAmount: price,
      lines: [{ itemId, unitId, quantity: 1, price, taxPercent: 0, lineOrder: 1 }],
    });
  }

  it('posts once, with one movement, one journal, and costing COGS', async () => {
    const { shift } = await openSession();
    const itemId = await stockedItem();
    const order = await draftSale(shift.id, itemId, 10);
    const posted = await posOrderPostingService.postOrder(ctx, order!.id);
    const again = await posOrderPostingService.postOrder(ctx, order!.id);

    const movements = await prisma.inventoryMovement.count({
      where: { companyId, sourceDocumentId: order!.id, movementType: 'POS-SALE' },
    });
    const journals = await prisma.journalEntry.count({
      where: { companyId, sourceNumber: order!.orderNumber, reversalOfJournalEntryId: null, deletedAt: null },
    });
    const line = await prisma.posOrderLine.findFirstOrThrow({ where: { orderId: order!.id } });
    const onHand = await prisma.itemWarehouseBalance.findUnique({
      where: { companyId_itemId_warehouseId: { companyId, itemId, warehouseId } },
    });

    expect(posted.status).toBe('POSTED');
    expect(again.journalEntryId).toBe(posted.journalEntryId);
    expect(movements).toBe(1);
    expect(journals).toBe(1);
    expect(Number(line.unitCost)).toBe(5);
    expect(Number(onHand?.quantityOnHand)).toBe(19);
  });

  it('two concurrent posts create one movement and one journal', async () => {
    const { shift } = await openSession();
    const itemId = await stockedItem();
    const order = await draftSale(shift.id, itemId);
    const [a, b] = await Promise.all([
      posOrderPostingService.postOrder(ctx, order!.id),
      posOrderPostingService.postOrder(ctx, order!.id),
    ]);
    expect(a.journalEntryId).toBe(b.journalEntryId);
    expect(
      await prisma.inventoryMovement.count({
        where: { companyId, sourceDocumentId: order!.id, movementType: 'POS-SALE' },
      })
    ).toBe(1);
  });

  it('rolls back the claim when the journal fails', async () => {
    const { shift } = await openSession();
    const itemId = await stockedItem();
    const order = await draftSale(shift.id, itemId);
    const spy = jest
      .spyOn(journalPostingService, 'createAndPostInTx')
      .mockRejectedValueOnce(new Error('journal failed'));
    await expect(posOrderPostingService.postOrder(ctx, order!.id)).rejects.toThrow('journal failed');
    spy.mockRestore();
    const row = await prisma.posOrder.findUniqueOrThrow({ where: { id: order!.id } });
    expect(row.status).toBe('DRAFT');
    expect(
      await prisma.inventoryMovement.count({ where: { companyId, sourceDocumentId: order!.id } })
    ).toBe(0);
  });

  it('rolls back the claim when costing fails', async () => {
    const { shift } = await openSession();
    const itemId = await stockedItem();
    const order = await draftSale(shift.id, itemId);
    const spy = jest
      .spyOn(inventoryCostingService, 'applyOutboundMovement')
      .mockRejectedValueOnce(new Error('costing failed'));
    await expect(posOrderPostingService.postOrder(ctx, order!.id)).rejects.toThrow('costing failed');
    spy.mockRestore();
    const row = await prisma.posOrder.findUniqueOrThrow({ where: { id: order!.id } });
    expect(row.status).toBe('DRAFT');
    expect(row.journalEntryId).toBeNull();
  });

  it('stores a 2dp net and rejects a tender that only matches a longer preview', async () => {
    const { shift } = await openSession();
    const itemId = await stockedItem();
    await expect(
      posOrderPostingService.createOrder(companyId, shift.id, {
        orderNumber: nextCode('PO'),
        paymentMethod: 'CASH',
        cashAmount: 10.004,
        lines: [{ itemId, unitId, quantity: 1, price: 10.004, taxPercent: 0, lineOrder: 1 }],
      })
    ).rejects.toThrow('Payment split must equal order net amount');

    const created = await posOrderPostingService.createOrder(companyId, shift.id, {
      orderNumber: nextCode('PO'),
      paymentMethod: 'CASH',
      cashAmount: 10,
      lines: [{ itemId, unitId, quantity: 1, price: 10.004, taxPercent: 0, lineOrder: 1 }],
    });
    expect(Number(created!.netAmount)).toBe(10);
  });

  it('allows one open session per terminal and isolates company and terminal', async () => {
    const a = await terminalFor(companyId, branchId, warehouseId);
    const b = await terminalFor(companyId, branchId, warehouseId);
    const first = await posShiftService.openShift(ctx, { terminalId: a.terminal.id, openingCash: 10 });
    expect(first.openTerminalKey).toBe(a.terminal.id);
    await expect(
      posShiftService.openShift(ctx, { terminalId: a.terminal.id, openingCash: 0 })
    ).rejects.toThrow('An open shift already exists on this terminal');

    const racedTerminal = await terminalFor(companyId, branchId, warehouseId);
    const raced = await Promise.allSettled([
      posShiftService.openShift(ctx, { terminalId: racedTerminal.terminal.id, openingCash: 1 }),
      posShiftService.openShift(ctx, { terminalId: racedTerminal.terminal.id, openingCash: 2 }),
    ]);
    expect(raced.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(raced.filter((row) => row.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.posShift.count({
        where: { companyId, terminalId: racedTerminal.terminal.id, status: 'OPEN' },
      })
    ).toBe(1);

    const otherTerminal = await posShiftService.openShift(ctx, { terminalId: b.terminal.id, openingCash: 0 });
    expect(otherTerminal.openTerminalKey).toBe(b.terminal.id);

    const otherWarehouse = (
      await prisma.warehouse.create({ data: { companyId: otherCompanyId, arabicName: `P1B WH ${suffix}` } })
    ).id;
    const otherTerminalRow = await terminalFor(otherCompanyId, otherBranchId, otherWarehouse);
    const otherCtx = posPostingContextFromIds({
      companyId: otherCompanyId,
      branchId: otherBranchId,
      fiscalYearId,
      userId: 'p1-other',
    });
    await expect(
      posShiftService.openShift(otherCtx, { terminalId: a.terminal.id, openingCash: 0 })
    ).rejects.toThrow('POS terminal not found');
    const otherOpen = await posShiftService.openShift(otherCtx, {
      terminalId: otherTerminalRow.terminal.id,
      openingCash: 0,
    });
    expect(otherOpen.companyId).toBe(otherCompanyId);

    const itemId = await stockedItem();
    const sale = await draftSale(first.id, itemId, 10);
    await posOrderPostingService.postOrder(ctx, sale!.id);
    await posShiftService.closeShift(ctx, first.id, 20);
    const closed = await prisma.posShift.findUniqueOrThrow({ where: { id: first.id } });
    expect(closed.status).toBe('CLOSED');
    expect(closed.openTerminalKey).toBeNull();

    const next = await posShiftService.openShift(ctx, { terminalId: a.terminal.id, openingCash: 0 });
    expect(next.status).toBe('OPEN');
    expect(next.openTerminalKey).toBe(a.terminal.id);
    await expect(posShiftService.reopenShift(ctx, first.id)).rejects.toThrow(
      'An open shift already exists on this terminal'
    );
    const stillClosed = await prisma.posShift.findUniqueOrThrow({ where: { id: first.id } });
    expect(stillClosed.status).toBe('CLOSED');
    expect(stillClosed.endOfDayJournalEntryId).toBeNull();
  });

  it('daily report and hub include posted orders only, for this company', async () => {
    const { shift } = await openSession();
    const itemId = await stockedItem();
    const postedOrder = await draftSale(shift.id, itemId, 12);
    await posOrderPostingService.postOrder(ctx, postedOrder!.id);
    const draft = await draftSale(shift.id, itemId, 12);
    const postedRow = await prisma.posOrder.findUniqueOrThrow({ where: { id: postedOrder!.id } });

    const report = await posService.getDailyPOSReport({
      companyId,
      date: postedRow.postedAt ?? new Date(),
      warehouseId,
    });
    const ids = report.sales.map((row: { id: string }) => row.id);
    expect(ids).toContain(postedOrder!.id);
    expect(ids).not.toContain(draft!.id);
    expect(report.summary.source).toBe('POS_ORDER');
    expect(report.historicalLimitation).toMatch(/no POS marker/);

    await posOrderPostingService.unpostOrder(ctx, postedOrder!.id);
    const after = await posService.getDailyPOSReport({
      companyId,
      date: postedRow.postedAt ?? new Date(),
      warehouseId,
    });
    expect(after.sales.map((row: { id: string }) => row.id)).not.toContain(postedOrder!.id);

    const { shift: shift2 } = await openSession();
    const again = await draftSale(shift2.id, itemId, 8);
    await posOrderPostingService.postOrder(ctx, again!.id);
    const hub = await posService.listPostedPosOrders(companyId, 50);
    expect(hub.rows.find((row) => row.id === again!.id)?.netAmount).toBe(8);
    expect(hub.summary.net).toBeCloseTo(
      hub.rows.reduce((sum, row) => sum + row.netAmount, 0),
      2
    );
    const otherHub = await posService.listPostedPosOrders(otherCompanyId, 50);
    expect(otherHub.rows.some((row) => row.id === again!.id)).toBe(false);
  });
});
