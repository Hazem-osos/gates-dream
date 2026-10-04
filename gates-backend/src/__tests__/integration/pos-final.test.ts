/**
 * POS final completion on a MySQL database whose name contains "test".
 * Apply 20260930220000_pos_final before running.
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { posOrderPostingService } from '../../modules/pos/services/pos-order-posting.service';
import { posShiftService } from '../../modules/pos/services/pos-shift.service';
import { posPostingContextFromIds } from '../../modules/pos/services/pos-posting-context';
import { savePosSettings } from '../../modules/pos/services/pos-workspace.service';
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

describeDb('POS final completion (real MySQL)', () => {
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
  let bankAccountId: string;
  let customerId: string;
  let userId: string;
  let shiftId: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `PF ${suffix}`, isActive: true } })).id;
    branchId = (await prisma.branch.create({ data: { companyId, arabicName: `PF Branch ${suffix}` } })).id;
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
    await account('1200', 'PF AR', 'asset');
    await account('1300', 'PF Inventory', 'asset');
    await account('2300', 'PF VAT', 'liability');
    await account('4100', 'PF Sales', 'revenue');
    await account('5100', 'PF COGS', 'expense');
    const cashGl = await account(nextCode('11'), 'PF Drawer', 'asset');
    const bankGl = await account(nextCode('12'), 'PF Bank GL', 'asset');
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
    warehouseId = (await prisma.warehouse.create({ data: { companyId, arabicName: `PF WH ${suffix}` } })).id;
    unitId = (await prisma.unit.create({ data: { companyId, arabicName: 'PF Unit', code: `U${suffix}` } })).id;
    safeId = (
      await prisma.safe.create({
        data: { companyId, code: nextCode('S'), arabicName: 'PF Safe', currencyCode: 'EGP', glAccountId: cashGl.id },
      })
    ).id;
    const bank = await prisma.bank.create({ data: { companyId, arabicName: `PF Bank ${suffix}`, code: nextCode('BK') } });
    bankAccountId = (
      await prisma.bankAccount.create({
        data: {
          companyId,
          bankId: bank.id,
          code: nextCode('BA'),
          arabicName: 'PF Bank Account',
          currencyCode: 'EGP',
          glAccountId: bankGl.id,
        },
      })
    ).id;
    customerId = (
      await prisma.customer.create({
        data: { companyId, arabicName: `PF Customer ${suffix}`, creditLimit: 5000, priceTier: 'RETAIL' },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: {
          companyId,
          email: `pf-${suffix}@example.com`,
          username: `pf${suffix}`,
          passwordHash: 'not-a-login',
          firstName: 'PF',
          lastName: 'Cashier',
        },
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
          name: `PF Terminal ${suffix}`,
        },
      })
    ).id;
    ctx = posPostingContextFromIds({ companyId, branchId, fiscalYearId, userId });
    shiftId = (await posShiftService.openShift(ctx, { terminalId, openingCash: 100 })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  async function stocked(priceRetail: number) {
    const item = await prisma.item.create({
      data: { companyId, arabicName: `PF Item ${nextCode('I')}`, priceRetail, defaultTaxPercent: 0 },
    });
    await prisma.itemUnit.create({ data: { itemId: item.id, unitId, isBaseUnit: true } });
    await sharedPrisma.$transaction((tx) =>
      inventoryCostingService.applyInboundMovement(tx, {
        companyId,
        branchId,
        itemId: item.id,
        warehouseId,
        quantity: 10,
        unitCost: 4,
        movementType: COSTING_MOVEMENT.PURCHASE,
        sourceType: 'PF-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: new Date('2026-01-02'),
        updateLastPurchasePrice: false,
      })
    );
    return item;
  }

  const pricing = () => ({ forceServerPricing: true, rejectUnauthorized: true, paymentsDeferred: true, userId });

  it('voids a posted sale once, restores stock, and keeps the payment row', async () => {
    const item = await stocked(25);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, lineOrder: 1 }] },
      pricing()
    );
    const posted = await posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CASH', amount: 25, tenderedAmount: 25, safeId },
    ]);
    await expect(posOrderPostingService.voidOrder(ctx, posted.id, '   ')).rejects.toMatchObject({ statusCode: 422 });
    const voided = await posOrderPostingService.voidOrder(ctx, posted.id, 'عميل تراجع');
    const again = await posOrderPostingService.voidOrder(ctx, posted.id, 'عميل تراجع');
    const onHand = await prisma.itemWarehouseBalance.findUnique({
      where: { companyId_itemId_warehouseId: { companyId, itemId: item.id, warehouseId } },
    });
    const payments = await prisma.posPayment.count({ where: { orderId: posted.id } });
    const original = await prisma.journalEntry.findFirst({
      where: { id: posted.journalEntryId!, companyId },
    });
    const contra = await prisma.journalEntry.count({
      where: { companyId, sourceType: 'POS-VOID', sourceNumber: posted.orderNumber },
    });
    const receipt = await posOrderPostingService.receipt(companyId, posted.id);
    expect(voided.status).toBe('VOIDED');
    expect(again.status).toBe('VOIDED');
    expect(again.voidJournalEntryId).toBe(voided.voidJournalEntryId);
    expect(voided.voidJournalEntryId).toBe(posted.journalEntryId);
    expect(Number(onHand?.quantityOnHand)).toBe(10);
    expect(payments).toBe(1);
    expect(original?.isPosted).toBe(false);
    expect(original?.isCancelled).toBe(true);
    expect(contra).toBe(0);
    expect(receipt.title).toBe('إيصال إلغاء');
  });

  it('lets only one of two simultaneous voids unpost the journal once', async () => {
    const item = await stocked(15);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, lineOrder: 1 }] },
      pricing()
    );
    const posted = await posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CASH', amount: 15, tenderedAmount: 15, safeId },
    ]);
    const results = await Promise.allSettled([
      posOrderPostingService.voidOrder(ctx, posted.id, 'ازدواج'),
      posOrderPostingService.voidOrder(ctx, posted.id, 'ازدواج'),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled').length).toBeGreaterThan(0);
    const contra = await prisma.journalEntry.count({
      where: { companyId, sourceType: 'POS-VOID', sourceNumber: posted.orderNumber },
    });
    expect(contra).toBe(0);
    const original = await prisma.journalEntry.findFirst({
      where: { id: posted.journalEntryId!, companyId },
    });
    expect(original?.isPosted).toBe(false);
    const current = await prisma.posOrder.findUniqueOrThrow({ where: { id: posted.id } });
    expect(current.status).toBe('VOIDED');
  });

  it('returns the same order when an offline key is sent twice', async () => {
    const item = await stocked(12);
    const key = `offline-${suffix}-${seq}`;
    const first = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      {
        orderNumber: nextCode('PO'),
        customerId,
        clientRequestId: key,
        lines: [{ itemId: item.id, unitId, quantity: 1, lineOrder: 1 }],
      },
      pricing()
    );
    const posted = await posOrderPostingService.postOrder(ctx, first!.id, [
      { method: 'CASH', amount: 12, tenderedAmount: 12, safeId },
    ]);
    const second = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      {
        orderNumber: nextCode('PO'),
        customerId,
        clientRequestId: key,
        lines: [{ itemId: item.id, unitId, quantity: 4, lineOrder: 1 }],
      },
      pricing()
    );
    const rows = await prisma.posOrder.count({ where: { companyId, clientRequestId: key } });
    expect(second!.id).toBe(posted.id);
    expect(second!.status).toBe('POSTED');
    expect(rows).toBe(1);
  });

  it('refuses a terminal card that has no provider approval', async () => {
    await prisma.posPaymentMethod.create({
      data: { companyId, code: 'CASH', displayName: 'نقدي', settlementType: 'CASH', safeId },
    });
    await prisma.posPaymentMethod.create({
      data: {
        companyId,
        code: 'CARD',
        displayName: 'بطاقة',
        settlementType: 'BANK',
        bankAccountId,
        captureMode: 'TERMINAL',
      },
    });
    const item = await stocked(20);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, lineOrder: 1 }] },
      pricing()
    );
    await expect(
      posOrderPostingService.postOrder(ctx, draft!.id, [{ method: 'CARD', amount: 20, bankAccountId }])
    ).rejects.toMatchObject({ statusCode: 422, message: 'Electronic payment is not approved by a provider' });
    const still = await prisma.posOrder.findUniqueOrThrow({ where: { id: draft!.id } });
    expect(still.status).toBe('DRAFT');
  });

  it('refuses to sell the same serial twice and restores it on void', async () => {
    const item = await stocked(30);
    const serial = `SN-${suffix}`;
    await prisma.inventoryItemSerial.create({
      data: { companyId, itemId: item.id, warehouseId, serial, status: 'AVAILABLE' },
    });
    const first = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      {
        orderNumber: nextCode('PO'),
        customerId,
        lines: [{ itemId: item.id, unitId, quantity: 1, serialNo: serial, lineOrder: 1 }],
      },
      pricing()
    );
    await posOrderPostingService.postOrder(ctx, first!.id, [
      { method: 'CASH', amount: 30, tenderedAmount: 30, safeId },
    ]);
    const sold = await prisma.inventoryItemSerial.findFirstOrThrow({ where: { companyId, itemId: item.id, serial } });
    expect(sold.status).toBe('SOLD');
    const second = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      {
        orderNumber: nextCode('PO'),
        customerId,
        lines: [{ itemId: item.id, unitId, quantity: 1, serialNo: serial, lineOrder: 1 }],
      },
      pricing()
    );
    await expect(
      posOrderPostingService.postOrder(ctx, second!.id, [
        { method: 'CASH', amount: 30, tenderedAmount: 30, safeId },
      ])
    ).rejects.toMatchObject({ statusCode: 422 });
    await posOrderPostingService.voidOrder(ctx, first!.id, 'إرجاع مسلسل');
    const restored = await prisma.inventoryItemSerial.findFirstOrThrow({ where: { companyId, itemId: item.id, serial } });
    expect(restored.status).toBe('AVAILABLE');
  });

  it('keeps the shift open when variance needs a supervisor and the cashier has none', async () => {
    await savePosSettings(companyId, { varianceTolerance: 0, varianceRequiresApproval: true });
    await expect(posShiftService.closeShift(ctx, shiftId, 0)).rejects.toMatchObject({
      statusCode: 422,
      message: 'POS variance needs supervisor approval',
    });
    const open = await prisma.posShift.findUniqueOrThrow({ where: { id: shiftId } });
    expect(open.status).toBe('OPEN');
  });
});
