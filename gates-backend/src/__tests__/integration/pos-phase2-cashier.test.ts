/**
 * Phase 2 cashier workflow on a MySQL database whose name contains "test".
 * Apply 20260930190000_pos_payments_and_hold before running.
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { posOrderPostingService } from '../../modules/pos/services/pos-order-posting.service';
import { posShiftService } from '../../modules/pos/services/pos-shift.service';
import { posCatalogService } from '../../modules/pos/services/pos-catalog.service';
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

describeDb('POS phase 2 cashier (real MySQL)', () => {
  jest.setTimeout(180_000);
  const suffix = String(Date.now());
  let seq = 0;
  const nextCode = (prefix: string) => `${prefix}${suffix.slice(-6)}${++seq}`;

  let companyId: string;
  let otherCompanyId: string;
  let branchId: string;
  let fiscalYearId: string;
  let warehouseId: string;
  let unitId: string;
  let ctx: PosPostingContext;
  let terminalId: string;
  let safeId: string;
  let bankAccountId: string;
  let customerId: string;

  let shiftId: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `P2 ${suffix}`, isActive: true } })).id;
    otherCompanyId = (await prisma.company.create({ data: { arabicName: `P2B ${suffix}`, isActive: true } })).id;
    branchId = (await prisma.branch.create({ data: { companyId, arabicName: `P2 Branch ${suffix}` } })).id;
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
    await account('1200', 'P2 AR', 'asset');
    await account('1300', 'P2 Inventory', 'asset');
    await account('2300', 'P2 VAT', 'liability');
    await account('4100', 'P2 Sales', 'revenue');
    await account('5100', 'P2 COGS', 'expense');
    const cashGl = await account(nextCode('11'), 'P2 Drawer', 'asset');
    const bankGl = await account(nextCode('12'), 'P2 Bank GL', 'asset');
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
    warehouseId = (await prisma.warehouse.create({ data: { companyId, arabicName: `P2 WH ${suffix}` } })).id;
    unitId = (await prisma.unit.create({ data: { companyId, arabicName: 'P2 Unit', code: `U${suffix}` } })).id;
    safeId = (
      await prisma.safe.create({
        data: { companyId, code: nextCode('S'), arabicName: 'P2 Safe', currencyCode: 'EGP', glAccountId: cashGl.id },
      })
    ).id;
    const bank = await prisma.bank.create({ data: { companyId, arabicName: `P2 Bank ${suffix}`, code: nextCode('BK') } });
    bankAccountId = (
      await prisma.bankAccount.create({
        data: {
          companyId,
          bankId: bank.id,
          code: nextCode('BA'),
          arabicName: 'P2 Bank Account',
          currencyCode: 'EGP',
          glAccountId: bankGl.id,
        },
      })
    ).id;
    customerId = (
      await prisma.customer.create({
        data: { companyId, arabicName: `P2 Customer ${suffix}`, creditLimit: 500, priceTier: 'RETAIL' },
      })
    ).id;
    terminalId = (
      await prisma.posTerminal.create({
        data: {
          companyId,
          branchId,
          warehouseId,
          safeId,
          bankAccountId,
          defaultCustomerId: customerId,
          name: `P2 Terminal ${suffix}`,
        },
      })
    ).id;
    ctx = posPostingContextFromIds({ companyId, branchId, fiscalYearId, userId: 'p2-cashier' });
    shiftId = (await posShiftService.openShift(ctx, { terminalId, openingCash: 150 })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  async function stocked(priceRetail: number, barcode?: string, name?: string) {
    const item = await prisma.item.create({
      data: {
        companyId,
        arabicName: name ?? `P2 Item ${nextCode('I')}`,
        priceRetail,
        barcode,
        defaultTaxPercent: 0,
      },
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
        sourceType: 'P2-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: new Date('2026-01-02'),
        updateLastPurchasePrice: false,
      })
    );
    return item;
  }

  it('stores opening cash and resolves the server price over a client price', async () => {
    const shift = await prisma.posShift.findUniqueOrThrow({ where: { id: shiftId } });
    expect(Number(shift.openingCash)).toBe(150);
    const item = await stocked(10);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shift.id,
      {
        orderNumber: nextCode('PO'),
        customerId,
        lines: [{ itemId: item.id, unitId, quantity: 1, price: 1, lineOrder: 1 }],
      },
      { forceServerPricing: true, paymentsDeferred: true }
    );
    expect(Number(draft!.netAmount)).toBe(10);
    expect(Number(draft!.lines[0].price)).toBe(10);

    const taxed = await prisma.item.create({
      data: { companyId, arabicName: `P2 Tax ${nextCode('I')}`, priceRetail: 100, defaultTaxPercent: 14 },
    });
    await prisma.itemUnit.create({ data: { itemId: taxed.id, unitId, isBaseUnit: true } });
    const taxedDraft = await posOrderPostingService.createOrder(
      companyId,
      shift.id,
      {
        orderNumber: nextCode('PO'),
        customerId,
        lines: [{ itemId: taxed.id, unitId, quantity: 1, price: 1, taxPercent: 0, lineOrder: 1 }],
      },
      { forceServerPricing: true, paymentsDeferred: true }
    );
    expect(Number(taxedDraft!.taxAmount)).toBe(14);
    expect(Number(taxedDraft!.netAmount)).toBe(114);
  });

  it('posts cash with change without booking the change, once under a double post', async () => {
    const shift = { id: shiftId };
    const item = await stocked(84.25);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shift.id,
      {
        orderNumber: nextCode('PO'),
        customerId,
        lines: [{ itemId: item.id, unitId, quantity: 1, lineOrder: 1 }],
      },
      { forceServerPricing: true, paymentsDeferred: true }
    );
    const payments = [{ method: 'CASH' as const, amount: 84.25, tenderedAmount: 100, safeId }];
    const [posted, again] = await Promise.all([
      posOrderPostingService.postOrder(ctx, draft!.id, payments),
      posOrderPostingService.postOrder(ctx, draft!.id, payments),
    ]);
    const rows = await prisma.posPayment.findMany({ where: { orderId: draft!.id } });
    const cashLine = await prisma.journalEntryLine.findFirst({
      where: { journalEntryId: posted.journalEntryId!, description: 'POS cash' },
    });
    expect(again.journalEntryId).toBe(posted.journalEntryId);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(84.25);
    expect(Number(rows[0].tenderedAmount)).toBe(100);
    expect(Number(rows[0].changeAmount)).toBe(15.75);
    expect(Number(cashLine?.debitBase)).toBe(84.25);
    expect(await prisma.inventoryMovement.count({ where: { sourceDocumentId: draft!.id } })).toBe(1);
  });

  it('posts a card sale and a three-way split, and rejects a mismatch', async () => {
    const shift = { id: shiftId };
    const cardItem = await stocked(40);
    const cardDraft = await posOrderPostingService.createOrder(
      companyId,
      shift.id,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: cardItem.id, unitId, quantity: 1, lineOrder: 1 }] },
      { forceServerPricing: true, paymentsDeferred: true }
    );
    await posOrderPostingService.postOrder(ctx, cardDraft!.id, [
      { method: 'CARD', amount: 40, bankAccountId },
    ]);
    const cardPay = await prisma.posPayment.findFirstOrThrow({ where: { orderId: cardDraft!.id } });
    expect(cardPay.method).toBe('CARD');
    expect(cardPay.bankAccountId).toBe(bankAccountId);

    const splitItem = await stocked(100);
    const splitDraft = await posOrderPostingService.createOrder(
      companyId,
      shift.id,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: splitItem.id, unitId, quantity: 1, lineOrder: 1 }] },
      { forceServerPricing: true, paymentsDeferred: true }
    );
    await posOrderPostingService.postOrder(ctx, splitDraft!.id, [
      { method: 'CASH', amount: 25, tenderedAmount: 25, safeId },
      { method: 'CARD', amount: 50, bankAccountId },
      { method: 'WALLET', amount: 25, bankAccountId, referenceNumber: 'W-1' },
    ]);
    expect(await prisma.posPayment.count({ where: { orderId: splitDraft!.id } })).toBe(3);

    const badItem = await stocked(10);
    const bad = await posOrderPostingService.createOrder(
      companyId,
      shift.id,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: badItem.id, unitId, quantity: 1, lineOrder: 1 }] },
      { forceServerPricing: true, paymentsDeferred: true }
    );
    await expect(
      posOrderPostingService.postOrder(ctx, bad!.id, [{ method: 'CASH', amount: 9, tenderedAmount: 9, safeId }])
    ).rejects.toThrow('Payment lines must equal the amount due');
    expect((await prisma.posOrder.findUniqueOrThrow({ where: { id: bad!.id } })).status).toBe('DRAFT');
    expect(await prisma.inventoryMovement.count({ where: { sourceDocumentId: bad!.id } })).toBe(0);
  });

  it('holds without stock or a journal and reloads the same draft', async () => {
    const shift = { id: shiftId };
    const item = await stocked(8);
    const held = await posOrderPostingService.createOrder(
      companyId,
      shift.id,
      {
        orderNumber: nextCode('PO'),
        customerId,
        notes: 'انتظار',
        lines: [{ itemId: item.id, unitId, quantity: 2, lineOrder: 1, notes: 'كيس' }],
      },
      { forceServerPricing: true, paymentsDeferred: true, hold: true, userId: 'p2-cashier' }
    );
    expect(held!.heldAt).toBeTruthy();
    expect(await prisma.inventoryMovement.count({ where: { sourceDocumentId: held!.id } })).toBe(0);
    expect(held!.journalEntryId).toBeNull();
    const listed = await posOrderPostingService.listHeld(companyId, shift.id);
    expect(listed.map((row) => row.id)).toContain(held!.id);
    const resumed = await posOrderPostingService.resumeHeld(companyId, held!.id);
    expect(resumed!.heldAt).toBeNull();
    expect(resumed!.lines[0].notes).toBe('كيس');
    expect(resumed!.notes).toBe('انتظار');
  });

  it('searches, pages, and looks up a barcode with one stock read', async () => {
    const marker = `P2CAT${suffix}`;
    const first = await stocked(3, `${marker}-1`, `${marker} A`);
    await stocked(4, `${marker}-2`, `${marker} B`);
    const page = await posCatalogService.search({
      companyId,
      warehouseId,
      customerId,
      q: marker,
      take: 1,
    });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    const next = await posCatalogService.search({
      companyId,
      warehouseId,
      customerId,
      q: marker,
      take: 1,
      cursor: page.nextCursor!,
    });
    expect(next.items).toHaveLength(1);
    expect(next.items[0].id).not.toBe(page.items[0].id);
    const found = await posCatalogService.barcode({ companyId, code: `${marker}-1`, warehouseId, customerId });
    expect(found?.id).toBe(first.id);
    expect(found?.onHand).toBe(20);
    expect(next.items[0].onHand).toBe(20);
    expect(found?.price).toBe(3);
    const other = await posCatalogService.barcode({ companyId: otherCompanyId, code: `${marker}-1` });
    expect(other).toBeNull();
    const people = await posCatalogService.customers(companyId, suffix);
    expect(people.some((row) => row.id === customerId)).toBe(true);
  });

  it('builds a receipt from the posted server values', async () => {
    const shift = { id: shiftId };
    const item = await stocked(10);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shift.id,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, lineOrder: 1 }] },
      { forceServerPricing: true, paymentsDeferred: true }
    );
    await posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CASH', amount: 10, tenderedAmount: 20, safeId },
    ]);
    const receipt = await posOrderPostingService.receipt(companyId, draft!.id);
    expect(receipt.net).toBe(10);
    expect(receipt.tendered).toBe(20);
    expect(receipt.change).toBe(10);
    expect(receipt.lines[0].price).toBe(10);
    expect(receipt.customerName).toContain('P2 Customer');
  });
});
