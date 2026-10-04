/**
 * Remaining POS completion gaps on a MySQL database whose name contains "test".
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { posOrderPostingService } from '../../modules/pos/services/pos-order-posting.service';
import { posShiftService } from '../../modules/pos/services/pos-shift.service';
import { posTerminalService } from '../../modules/pos/services/pos-terminal.service';
import { posPaymentMethodService } from '../../modules/pos/services/pos-payment-method.service';
import { posPostingContextFromIds } from '../../modules/pos/services/pos-posting-context';
import { posRetailReport } from '../../modules/pos/services/pos-report.service';
import { recordPosAudit } from '../../modules/pos/services/pos-audit.service';
import {
  collectPosCredit,
  decidePosApproval,
  listPosAudit,
  requestPosApproval,
  savePosSettings,
} from '../../modules/pos/services/pos-workspace.service';
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

describeDb('POS remaining gaps (real MySQL)', () => {
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
  let approverCtx: PosPostingContext;
  let terminalId: string;
  let safeId: string;
  let bankAccountId: string;
  let customerId: string;
  let userId: string;
  let approverId: string;
  let shiftId: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `GAP ${suffix}`, isActive: true } })).id;
    otherCompanyId = (await prisma.company.create({ data: { arabicName: `GAP2 ${suffix}`, isActive: true } })).id;
    branchId = (await prisma.branch.create({ data: { companyId, arabicName: `GAP Branch ${suffix}` } })).id;
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
    await account('1200', 'GAP AR', 'asset');
    await account('1300', 'GAP Inventory', 'asset');
    await account('2300', 'GAP VAT', 'liability');
    await account('4100', 'GAP Sales', 'revenue');
    await account('5100', 'GAP COGS', 'expense');
    const cashGl = await account(nextCode('11'), 'GAP Drawer', 'asset');
    const bankGl = await account(nextCode('12'), 'GAP Bank GL', 'asset');
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
    warehouseId = (await prisma.warehouse.create({ data: { companyId, arabicName: `GAP WH ${suffix}` } })).id;
    unitId = (await prisma.unit.create({ data: { companyId, arabicName: 'GAP Unit', code: `U${suffix}` } })).id;
    safeId = (
      await prisma.safe.create({
        data: { companyId, code: nextCode('S'), arabicName: 'GAP Safe', currencyCode: 'EGP', glAccountId: cashGl.id },
      })
    ).id;
    const bank = await prisma.bank.create({ data: { companyId, arabicName: `GAP Bank ${suffix}`, code: nextCode('BK') } });
    bankAccountId = (
      await prisma.bankAccount.create({
        data: {
          companyId,
          bankId: bank.id,
          code: nextCode('BA'),
          arabicName: 'GAP Bank Account',
          currencyCode: 'EGP',
          glAccountId: bankGl.id,
        },
      })
    ).id;
    customerId = (
      await prisma.customer.create({
        data: { companyId, arabicName: `GAP Customer ${suffix}`, creditLimit: 5000, balance: 100, priceTier: 'RETAIL' },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: {
          companyId,
          email: `gap-${suffix}@example.com`,
          username: `gap${suffix}`,
          passwordHash: 'not-a-login',
          firstName: 'GAP',
          lastName: 'Cashier',
        },
      })
    ).id;
    approverId = (
      await prisma.user.create({
        data: {
          companyId,
          email: `gap-sv-${suffix}@example.com`,
          username: `gapsv${suffix}`,
          passwordHash: 'not-a-login',
          firstName: 'GAP',
          lastName: 'Supervisor',
        },
      })
    ).id;
    await prisma.userPermission.create({
      data: { userId: approverId, companyId, resource: 'pos', action: 'approve', allow: true },
    });
    terminalId = (
      await prisma.posTerminal.create({
        data: {
          companyId,
          branchId,
          warehouseId,
          safeId,
          bankAccountId,
          defaultCustomerId: customerId,
          name: `GAP Terminal ${suffix}`,
        },
      })
    ).id;
    ctx = posPostingContextFromIds({ companyId, branchId, fiscalYearId, userId });
    approverCtx = posPostingContextFromIds({ companyId, branchId, fiscalYearId, userId: approverId });
    shiftId = (await posShiftService.openShift(ctx, { terminalId, openingCash: 50 })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  async function stocked(priceRetail: number) {
    const item = await prisma.item.create({
      data: { companyId, arabicName: `GAP Item ${nextCode('I')}`, priceRetail, defaultTaxPercent: 0 },
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
        sourceType: 'GAP-SEED',
        sourceNumber: item.id.slice(0, 8),
        transactionDate: new Date('2026-01-02'),
        updateLastPurchasePrice: false,
      })
    );
    return item;
  }

  const pricing = () => ({ forceServerPricing: true, rejectUnauthorized: true, paymentsDeferred: true, userId });

  async function postedSale(price = 20) {
    const item = await stocked(price);
    const draft = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      { orderNumber: nextCode('PO'), customerId,       lines: [{ itemId: item.id, unitId, quantity: 4, lineOrder: 1 }] },
      pricing()
    );
    const posted = await posOrderPostingService.postOrder(ctx, draft!.id, [
      { method: 'CASH', amount: price * 4, tenderedAmount: price * 4, safeId },
    ]);
    return { item, posted };
  }

  it('posts a return without approval while the policy is off, then blocks, approves, and refuses reuse', async () => {
    const { posted } = await postedSale(20);
    const openReturn = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: posted.id,
      notes: 'مقاس',
      lines: [{ originalLineId: posted.lines[0].id, quantity: 1 }],
    });
    const postedReturn = await posOrderPostingService.postOrder(ctx, openReturn!.id, [
      { method: 'CASH', amount: 20, tenderedAmount: 20, safeId },
    ]);
    expect(postedReturn.status).toBe('POSTED');

    await savePosSettings(companyId, { returnRequiresApproval: true });
    const waiting = await posOrderPostingService.createReturn(ctx, {
      shiftId,
      originalOrderId: posted.id,
      notes: 'تالف',
      lines: [{ originalLineId: posted.lines[0].id, quantity: 1 }],
    });
    await expect(
      posOrderPostingService.postOrder(ctx, waiting!.id, [{ method: 'CASH', amount: 20, tenderedAmount: 20, safeId }])
    ).rejects.toMatchObject({ statusCode: 403, message: 'POS return needs supervisor approval' });
    const stillDraft = await prisma.posOrder.findUniqueOrThrow({ where: { id: waiting!.id } });
    expect(stillDraft.status).toBe('DRAFT');

    const request = await requestPosApproval(companyId, {
      action: 'RETURN',
      reason: 'موافقة مرتجع',
      requesterId: userId,
      orderId: waiting!.id,
      shiftId,
    });
    await expect(decidePosApproval(companyId, request.id, userId, true)).rejects.toMatchObject({ statusCode: 403 });
    const rejected = await requestPosApproval(companyId, {
      action: 'RETURN',
      reason: 'مرفوض',
      requesterId: userId,
      orderId: waiting!.id,
      shiftId,
    });
    await decidePosApproval(companyId, rejected.id, approverId, false);
    await expect(
      posOrderPostingService.postOrder(ctx, waiting!.id, [{ method: 'CASH', amount: 20, tenderedAmount: 20, safeId }], {
        approvalId: rejected.id,
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    await decidePosApproval(companyId, request.id, approverId, true);
    const other = await posOrderPostingService.createReturn(approverCtx, {
      shiftId,
      originalOrderId: posted.id,
      lines: [{ originalLineId: posted.lines[0].id, quantity: 1 }],
    });
    await expect(
      posOrderPostingService.postOrder(ctx, other!.id, [{ method: 'CASH', amount: 20 }], { approvalId: request.id })
    ).rejects.toMatchObject({ statusCode: 403, message: 'POS return approval does not match this order' });

    const approved = await posOrderPostingService.postOrder(
      ctx,
      waiting!.id,
      [{ method: 'CASH', amount: 20, tenderedAmount: 20, safeId }],
      { approvalId: request.id }
    );
    expect(approved.status).toBe('POSTED');
    const again = await posOrderPostingService.postOrder(
      ctx,
      waiting!.id,
      [{ method: 'CASH', amount: 20, tenderedAmount: 20, safeId }],
      { approvalId: request.id }
    );
    expect(again.status).toBe('POSTED');
    const consumed = await prisma.posApproval.findUniqueOrThrow({ where: { id: request.id } });
    expect(consumed.status).toBe('CONSUMED');
    expect(consumed.consumedByOrderId).toBe(waiting!.id);
    await expect(
      posOrderPostingService.postOrder(ctx, other!.id, [{ method: 'CASH', amount: 20 }], { approvalId: request.id })
    ).rejects.toMatchObject({ statusCode: 403 });

    const foreign = await prisma.posApproval.create({
      data: {
        companyId: otherCompanyId,
        action: 'RETURN',
        status: 'APPROVED',
        requesterId: userId,
        approverId,
        reason: 'شركة أخرى',
        orderId: other!.id,
      },
    });
    await expect(
      posOrderPostingService.postOrder(ctx, other!.id, [{ method: 'CASH', amount: 20 }], { approvalId: foreign.id })
    ).rejects.toMatchObject({ statusCode: 403 });

    const self = await requestPosApproval(companyId, {
      action: 'RETURN',
      reason: 'نفس المستخدم',
      requesterId: userId,
      orderId: other!.id,
      shiftId,
    });
    await prisma.posApproval.update({
      where: { id: self.id },
      data: { status: 'APPROVED', approverId: userId, decidedAt: new Date() },
    });
    await expect(
      posOrderPostingService.postOrder(ctx, other!.id, [{ method: 'CASH', amount: 20 }], { approvalId: self.id })
    ).rejects.toMatchObject({ statusCode: 403, message: 'POS approval needs a different supervisor' });

    const raceApproval = await requestPosApproval(companyId, {
      action: 'RETURN',
      reason: 'سباق',
      requesterId: userId,
      orderId: other!.id,
      shiftId,
    });
    await decidePosApproval(companyId, raceApproval.id, approverId, true);
    const raced = await Promise.allSettled([
      posOrderPostingService.postOrder(ctx, other!.id, [{ method: 'CASH', amount: 20, tenderedAmount: 20, safeId }], {
        approvalId: raceApproval.id,
      }),
      posOrderPostingService.postOrder(ctx, other!.id, [{ method: 'CASH', amount: 20, tenderedAmount: 20, safeId }], {
        approvalId: raceApproval.id,
      }),
    ]);
    expect(raced.some((row) => row.status === 'fulfilled')).toBe(true);
    const finalReturn = await prisma.posOrder.findUniqueOrThrow({ where: { id: other!.id } });
    expect(finalReturn.status).toBe('POSTED');
    const returnJournals = await prisma.journalEntry.count({
      where: { companyId, sourceNumber: finalReturn.orderNumber, sourceType: 'POS' },
    });
    expect(returnJournals).toBe(1);

    const audits = await listPosAudit(companyId, { documentId: waiting!.id });
    expect(audits.some((row) => (row.metadata as { action?: string }).action === 'SUBMITTED')).toBe(true);
    expect(audits.some((row) => (row.metadata as { action?: string }).action === 'APPROVED')).toBe(true);
    expect(audits.some((row) => (row.metadata as { action?: string }).action === 'POSTED')).toBe(true);
  });

  it('collects credit once when the same key is sent twice, including at the same time', async () => {
    const before = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    const key = `col-${suffix}`;
    const first = await collectPosCredit(ctx, { customerId, amount: 15, safeId, clientRequestId: key });
    const second = await collectPosCredit(ctx, { customerId, amount: 15, safeId, clientRequestId: key });
    expect(second.id).toBe(first.id);
    const racedKey = `col-race-${suffix}`;
    const raced = await Promise.all([
      collectPosCredit(ctx, { customerId, amount: 5, safeId, clientRequestId: racedKey }),
      collectPosCredit(ctx, { customerId, amount: 5, safeId, clientRequestId: racedKey }),
    ]);
    expect(raced[0].id).toBe(raced[1].id);
    const rows = await prisma.posCreditCollection.count({ where: { companyId, clientRequestId: { in: [key, racedKey] } } });
    const journals = await prisma.journalEntry.count({ where: { companyId, sourceType: 'POS-COLLECTION' } });
    const after = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(rows).toBe(2);
    expect(journals).toBe(2);
    expect(Number(after.balance)).toBe(Number(before.balance) - 20);
  });

  it('rejects an unsafe payment destination and a terminal disable during an open session', async () => {
    await expect(
      posPaymentMethodService.create(companyId, { code: 'CASH2', displayName: 'نقد', settlementType: 'CASH' })
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      posPaymentMethodService.create(companyId, {
        code: 'CARD2',
        displayName: 'بطاقة',
        settlementType: 'CASH',
        safeId,
        captureMode: 'TERMINAL',
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    await posPaymentMethodService.create(companyId, {
      code: 'CASH',
      displayName: 'نقدي',
      settlementType: 'CASH',
      safeId,
    });
    const created = await posPaymentMethodService.create(companyId, {
      code: 'CARD3',
      displayName: 'بطاقة يدوية',
      settlementType: 'BANK',
      bankAccountId,
      captureMode: 'MANUAL',
      terminalId,
      sortOrder: 3,
    });
    expect(created.captureMode).toBe('MANUAL');
    await expect(posTerminalService.update(companyId, terminalId, { isActive: false })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('keeps audit rows inside the company and reports the new dimensions from posted orders', async () => {
    await recordPosAudit({
      companyId,
      entityType: 'POS_ORDER',
      entityId: shiftId,
      action: 'UPDATED',
      userId,
      terminalId,
      shiftId,
      reason: 'note',
    });
    const foreign = await listPosAudit(otherCompanyId, {});
    expect(foreign.some((row) => row.subjectId === shiftId)).toBe(false);
    const own = await listPosAudit(companyId, { terminalId, shiftId });
    expect(own.some((row) => row.subjectId === shiftId)).toBe(true);

    const report = await posRetailReport(companyId, {
      from: new Date('2026-01-01'),
      to: new Date('2027-01-01'),
    });
    expect(report.byHour.length).toBeGreaterThan(0);
    expect(report.byTerminal.some((row) => row.terminalId === terminalId)).toBe(true);
    expect(report.byBranch.some((row) => row.branchId === branchId)).toBe(true);
    expect(report.byCustomer.some((row) => row.customerId === customerId)).toBe(true);
    expect(report.byCashier.length).toBeGreaterThan(0);
    expect(report.totals.net).toBeGreaterThan(0);
    expect(report.totals).toEqual(expect.objectContaining({ tax: expect.any(Number), cogs: expect.any(Number), grossProfit: expect.any(Number) }));
    expect(report.returnReasons.some((row) => row.reason === 'مقاس' || row.reason === 'تالف')).toBe(true);
  });

  it('returns the same offline order when the sync key is repeated', async () => {
    const item = await stocked(9);
    const key = `sync-${suffix}`;
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
    await posOrderPostingService.postOrder(ctx, first!.id, [{ method: 'CASH', amount: 9, tenderedAmount: 9, safeId }]);
    const second = await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      {
        orderNumber: nextCode('PO'),
        customerId,
        clientRequestId: key,
        lines: [{ itemId: item.id, unitId, quantity: 3, lineOrder: 1 }],
      },
      pricing()
    );
    expect(second!.id).toBe(first!.id);
    expect(await prisma.posOrder.count({ where: { companyId, clientRequestId: key } })).toBe(1);
  });
});
