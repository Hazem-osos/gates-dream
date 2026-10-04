/**
 * Phase 4B retail controls on a MySQL database whose name contains "test".
 * Apply 20260930210000_pos_phase4b_retail before running.
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { posOrderPostingService } from '../../modules/pos/services/pos-order-posting.service';
import { posShiftService } from '../../modules/pos/services/pos-shift.service';
import { posPaymentMethodService } from '../../modules/pos/services/pos-payment-method.service';
import { searchPosPostingAccounts } from '../../modules/pos/services/pos-account-lookup.service';
import { posRetailReport } from '../../modules/pos/services/pos-report.service';
import { canDiscountPos, canOverridePosPrice } from '../../modules/pos/services/pos-pricing.service';
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

describeDb('POS phase 4B retail controls (real MySQL)', () => {
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
  let categoryId: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `P4B ${suffix}`, isActive: true } })).id;
    branchId = (await prisma.branch.create({ data: { companyId, arabicName: `P4B Branch ${suffix}` } })).id;
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
    await account('1200', 'P4B AR', 'asset');
    await account('1300', 'P4B Inventory', 'asset');
    await account('2300', 'P4B VAT', 'liability');
    await account('4100', 'P4B Sales', 'revenue');
    await account('5100', 'P4B COGS', 'expense');
    const cashGl = await account(nextCode('11'), 'P4B Drawer', 'asset');
    const bankGl = await account(nextCode('12'), 'P4B Bank GL', 'asset');
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
    warehouseId = (await prisma.warehouse.create({ data: { companyId, arabicName: `P4B WH ${suffix}` } })).id;
    unitId = (await prisma.unit.create({ data: { companyId, arabicName: 'P4B Unit', code: `U${suffix}` } })).id;
    safeId = (
      await prisma.safe.create({
        data: { companyId, code: nextCode('S'), arabicName: 'P4B Safe', currencyCode: 'EGP', glAccountId: cashGl.id },
      })
    ).id;
    const bank = await prisma.bank.create({ data: { companyId, arabicName: `P4B Bank ${suffix}`, code: nextCode('BK') } });
    bankAccountId = (
      await prisma.bankAccount.create({
        data: {
          companyId,
          bankId: bank.id,
          code: nextCode('BA'),
          arabicName: 'P4B Bank Account',
          currencyCode: 'EGP',
          glAccountId: bankGl.id,
        },
      })
    ).id;
    customerId = (
      await prisma.customer.create({
        data: { companyId, arabicName: `P4B Customer ${suffix}`, creditLimit: 5000, priceTier: 'RETAIL' },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: {
          companyId,
          email: `p4b-${suffix}@example.com`,
          username: `p4b${suffix}`,
          passwordHash: 'not-a-login',
          firstName: 'P4B',
          lastName: 'Cashier',
        },
      })
    ).id;
    await prisma.userPermission.createMany({
      data: [
        { userId, companyId, resource: 'pos', action: 'discount', allow: true },
        { userId, companyId, resource: 'pos', action: 'override_tier_price', allow: true },
        { userId, companyId, resource: 'pos', action: 'reprint', allow: true },
      ],
    });
    categoryId = (
      await prisma.itemCategory.create({ data: { companyId, arabicName: `P4B Cat ${suffix}`, code: nextCode('C') } })
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
          name: `P4B Terminal ${suffix}`,
        },
      })
    ).id;
    ctx = posPostingContextFromIds({ companyId, branchId, fiscalYearId, userId });
    shiftId = (await posShiftService.openShift(ctx, { terminalId, openingCash: 200 })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  async function stocked(priceRetail: number, tax = 0) {
    const item = await prisma.item.create({
      data: {
        companyId,
        arabicName: `P4B Item ${nextCode('I')}`,
        priceRetail,
        defaultTaxPercent: tax,
        categoryId,
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
        sourceType: 'P4B-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: new Date('2026-01-02'),
        updateLastPurchasePrice: false,
      })
    );
    return item;
  }

  const httpPricing = (extra: Record<string, unknown> = {}) => ({
    forceServerPricing: true,
    rejectUnauthorized: true,
    paymentsDeferred: true,
    userId,
    ...extra,
  });

  it('rejects a discount and a price override without the matching permission flag', async () => {
    expect(await canDiscountPos(companyId, 'missing-user')).toBe(false);
    expect(await canOverridePosPrice(companyId, 'missing-user')).toBe(false);
    expect(await canDiscountPos(companyId, userId)).toBe(true);
    expect(await canOverridePosPrice(companyId, userId)).toBe(true);

    const item = await stocked(100, 14);
    await expect(
      posOrderPostingService.createOrder(
        companyId,
        shiftId,
        { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, discountPercent: 10, lineOrder: 1 }] },
        httpPricing({ userId: 'missing-user', trustDiscount: false, trustPrice: false })
      )
    ).rejects.toMatchObject({ statusCode: 403, message: 'POS manual discount is not permitted' });

    await expect(
      posOrderPostingService.createOrder(
        companyId,
        shiftId,
        { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, price: 50, lineOrder: 1 }] },
        httpPricing({ userId: 'missing-user', trustDiscount: false, trustPrice: false })
      )
    ).rejects.toMatchObject({ statusCode: 403, message: 'POS price override is not permitted' });
  });

  it('applies an authorized discount and keeps tax on the discounted base', async () => {
    const item = await stocked(100, 14);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, discountPercent: 10, lineOrder: 1 }] },
      httpPricing({ trustDiscount: true })
    );
    expect(Number(draft!.discountAmount)).toBe(10);
    expect(Number(draft!.taxAmount)).toBe(12.6);
    expect(Number(draft!.netAmount)).toBe(102.6);
    const posted = await posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CASH', amount: 102.6, tenderedAmount: 102.6, safeId },
    ]);
    expect(Number(posted.netAmount)).toBe(102.6);
    const audit = await prisma.activityLog.findFirst({
      where: { tenantId: companyId, subjectId: draft!.id, kind: 'document-audit' },
      orderBy: { at: 'desc' },
    });
    const metadata = audit?.metadata as { action?: string; kind?: string } | null;
    expect(metadata?.action).toBe('POSTED');
    const discountAudit = await prisma.activityLog.findMany({
      where: { tenantId: companyId, subjectId: draft!.id },
    });
    expect(discountAudit.some((row) => (row.metadata as { kind?: string }).kind === 'discount')).toBe(true);
  });

  it('keeps the resolved list price when an authorized override changes the selling price', async () => {
    const item = await stocked(100, 14);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, price: 80, lineOrder: 1 }] },
      httpPricing({ trustPrice: true })
    );
    expect(Number(draft!.lines[0].listPrice)).toBe(100);
    expect(Number(draft!.lines[0].price)).toBe(80);
    expect(Number(draft!.taxAmount)).toBe(11.2);
    expect(Number(draft!.netAmount)).toBe(91.2);
    await posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CASH', amount: 91.2, tenderedAmount: 91.2, safeId },
    ]);
    const audits = await prisma.activityLog.findMany({ where: { tenantId: companyId, subjectId: draft!.id } });
    expect(audits.some((row) => (row.metadata as { kind?: string }).kind === 'price-override')).toBe(true);
  });

  it('prints a return receipt from the posted refund and audits a reprint', async () => {
    const item = await stocked(40, 0);
    const sale = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 2, lineOrder: 1 }] },
      httpPricing()
    );
    await posOrderPostingService.postOrder(ctx, sale!.id, [
      { method: 'CASH', amount: 80, tenderedAmount: 80, safeId },
    ]);
    const draftReturn = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: sale!.id,
      lines: [{ originalLineId: sale!.lines[0].id, quantity: 1 }],
    });
    const postedReturn = await posOrderPostingService.postOrder(ctx, draftReturn!.id, [
      { method: 'CASH', amount: 40, tenderedAmount: 40, safeId },
    ]);
    const printed = await posOrderPostingService.receipt(companyId, postedReturn.id);
    expect(printed.title).toBe('إيصال مرتجع');
    expect(printed.orderType).toBe('RETURN');
    expect(printed.originalOrderNumber).toBe(sale!.orderNumber);
    expect(printed.lines[0].quantity).toBe(1);
    expect(printed.net).toBe(40);
    expect(printed.payments[0].amount).toBe(40);

    const again = await posOrderPostingService.reprint(companyId, postedReturn.id, userId);
    expect(again.orderNumber).toBe(printed.orderNumber);
    const reprintAudit = await prisma.activityLog.findFirst({
      where: { tenantId: companyId, subjectId: postedReturn.id, kind: 'document-audit' },
      orderBy: { at: 'desc' },
    });
    expect((reprintAudit?.metadata as { action?: string }).action).toBe('REPRINTED');
    expect(reprintAudit?.actorId).toBe(userId);
  });

  it('sells on a configured method, rejects it when disabled, and keeps the historical label', async () => {
    await posPaymentMethodService.create(companyId, {
      code: 'CASH',
      displayName: 'نقدي',
      settlementType: 'CASH',
      safeId,
    });
    const voucher = await posPaymentMethodService.create(companyId, {
      code: 'VOUCHER',
      displayName: 'قسيمة',
      settlementType: 'BANK',
      bankAccountId,
    });
    const item = await stocked(25, 0);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, lineOrder: 1 }] },
      httpPricing()
    );
    await posOrderPostingService.postOrder(ctx, draft!.id, [{ method: 'VOUCHER', amount: 25, bankAccountId }]);
    await posPaymentMethodService.update(companyId, voucher.id, { isActive: false, displayName: 'قسيمة موقوفة' });
    const historical = await prisma.posPayment.findFirstOrThrow({ where: { orderId: draft!.id } });
    expect(historical.method).toBe('VOUCHER');
    expect(historical.methodLabel).toBe('قسيمة');
    expect(historical.settlementType).toBe('BANK');

    const next = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId, lines: [{ itemId: item.id, unitId, quantity: 1, lineOrder: 1 }] },
      httpPricing()
    );
    await expect(
      posOrderPostingService.postOrder(ctx, next!.id, [{ method: 'VOUCHER', amount: 25, bankAccountId }])
    ).rejects.toThrow('POS payment method is not active');

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
    const report = await posRetailReport(companyId, { from: dayStart, to: dayEnd, terminalId, branchId, shiftId });
    expect(report.byCashier.some((row) => row.cashierId === userId && row.net > 0)).toBe(true);
    expect(report.byItem.length).toBeGreaterThan(0);
    expect(report.byCategory.some((row) => row.name.includes('P4B Cat'))).toBe(true);
    expect(report.byPaymentMethod.some((row) => row.method === 'VOUCHER' && row.amount === 25)).toBe(true);
    expect(report.returns.count).toBeGreaterThan(0);
    expect(report.bySession.some((row) => row.shiftId === shiftId && row.orders > 0)).toBe(true);
  });

  it('searches posting accounts and skips a header that has children', async () => {
    const token = `بحث${suffix.slice(-4)}`;
    const parent = await prisma.account.create({
      data: { companyId, code: nextCode('90'), arabicName: `مجموعة ${token}`, accountType: 'asset', accountKind: 'HEADER' },
    });
    const leaf = await prisma.account.create({
      data: {
        companyId,
        code: nextCode('91'),
        arabicName: `صندوق ${token}`,
        accountType: 'asset',
        accountKind: 'POSTING',
        parentId: parent.id,
      },
    });
    const rows = await searchPosPostingAccounts(companyId, token, 20);
    expect(rows.map((row) => row.id)).toEqual([leaf.id]);
  });
});
