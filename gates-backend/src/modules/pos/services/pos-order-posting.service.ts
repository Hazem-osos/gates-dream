import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { itemCostService } from '../../inventory/services/item-cost.service';
import { stockMovementService } from '../../inventory/services/stock-movement.service';
import { taxPeriodService } from '../../taxes/services/tax-period.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { posAccountResolverService } from './pos-account-resolver.service';
import { computeLineAmounts } from '../../invoices/services/invoice-line-math';
import type { CreatePosOrderInput, PosPostingContext } from '../types/pos.types';

/** H12 fix: match the invoice tender-split tolerance (was a much looser 0.02). */
const TENDER_TOLERANCE = 0.0001;

function calcLineTotals(lines: CreatePosOrderInput['lines']) {
  let totalAmount = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  // H3/H12/H15 fix: reuse the SAME server-side line math as invoices — tax is
  // always percent-derived (never a poisoned flat override), discount is
  // recomputed from discountPercent when present, and every figure rounds to
  // 4dp at the point of calculation instead of drifting as raw JS floats.
  const computed = lines.map((line) => {
    const { lineTotal, lineDiscount, lineTax } = computeLineAmounts(line);
    const afterDiscount = roundTo4(lineTotal - lineDiscount);
    totalAmount = roundTo4(totalAmount + lineTotal);
    discountAmount = roundTo4(discountAmount + lineDiscount);
    taxAmount = roundTo4(taxAmount + lineTax);
    return {
      ...line,
      lineTotal: afterDiscount,
      lineDiscount,
      taxAmount: lineTax,
    };
  });

  const netAmount = roundTo4(totalAmount - discountAmount + taxAmount);
  return {
    lines: computed,
    totalAmount,
    discountAmount,
    taxAmount,
    netAmount,
    merchandise: roundTo4(totalAmount - discountAmount),
  };
}

export class PosOrderPostingService {
  async createOrder(companyId: string, shiftId: string, input: CreatePosOrderInput) {
    const shift = await prisma.posShift.findFirst({
      where: { id: shiftId, companyId, status: 'OPEN' },
    });
    if (!shift) throw new AppError(404, 'Open POS shift not found');

    const totals = calcLineTotals(input.lines);
    this.validateTenders(input, totals.netAmount);

    return prisma.$transaction(async (tx) => {
      const order = await tx.posOrder.create({
        data: {
          companyId,
          shiftId,
          orderNumber: input.orderNumber,
          orderType: input.orderType ?? 'SALE',
          originalOrderId: input.originalOrderId,
          customerId: input.customerId,
          status: 'DRAFT',
          totalAmount: new Decimal(totals.totalAmount),
          discountAmount: new Decimal(totals.discountAmount),
          taxAmount: new Decimal(totals.taxAmount),
          netAmount: new Decimal(totals.netAmount),
          cashAmount: new Decimal(input.cashAmount ?? 0),
          cardAmount: new Decimal(input.cardAmount ?? 0),
          creditAmount: new Decimal(input.creditAmount ?? 0),
          paymentMethod: input.paymentMethod,
          currencyCode: input.currencyCode ?? 'EGP',
        },
      });

      await tx.posOrderLine.createMany({
        data: totals.lines.map((l) => ({
          orderId: order.id,
          itemId: l.itemId,
          unitId: l.unitId,
          quantity: new Decimal(l.quantity),
          price: new Decimal(l.price),
          discountPercent: l.discountPercent != null ? new Decimal(l.discountPercent) : null,
          discountAmount: new Decimal(l.lineDiscount ?? 0),
          taxPercent: new Decimal(l.taxPercent ?? 0),
          taxAmount: new Decimal(l.taxAmount),
          lineTotal: new Decimal(l.lineTotal),
          unitCost: new Decimal(0),
          lineOrder: l.lineOrder,
        })),
      });

      return tx.posOrder.findUnique({
        where: { id: order.id },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
    });
  }

  private validateTenders(input: CreatePosOrderInput, netAmount: number) {
    const cash = input.cashAmount ?? 0;
    const card = input.cardAmount ?? 0;
    const credit = input.creditAmount ?? 0;
    const sum = roundTo4(cash + card + credit);
    if (Math.abs(sum - netAmount) > TENDER_TOLERANCE) {
      throw new AppError(422, 'Payment split must equal order net amount');
    }
    if (input.paymentMethod === 'CASH' && (card > 0 || credit > 0)) {
      throw new AppError(422, 'CASH payment method cannot include card/credit amounts');
    }
    if (input.paymentMethod === 'CARD' && (cash > 0 || credit > 0)) {
      throw new AppError(422, 'CARD payment method requires card amount only');
    }
    if (input.paymentMethod === 'CREDIT' && (cash > 0 || card > 0)) {
      throw new AppError(422, 'CREDIT payment method requires credit amount only');
    }
  }

  private async allocateGlNumInTx(
    tx: Prisma.TransactionClient,
    ctx: PosPostingContext
  ): Promise<string | undefined> {
    return documentSequenceService.nextGlNumberInTx(tx, ctx);
  }

  /**
   * C10 fix: an order now posts a real, balanced journal entry the moment it
   * is posted — revenue/VAT/COGS/inventory/tender all hit the GL immediately,
   * instead of waiting for `pos-shift.service.ts#closeShift` to aggregate a
   * single end-of-day entry. Between order and shift close there is no longer
   * a window where stock has moved but the ledger hasn't. Shift close is now
   * purely a cash-drawer reconciliation (see `closeShift`).
   *
   * H12 fix: cost is read as of the ORDER's own date, not `new Date()` at
   * post time — posting a shift's orders out of order, or posting late, no
   * longer silently re-prices COGS to whatever the average is right now.
   */
  async postOrder(ctx: PosPostingContext, orderId: string) {
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      include: {
        lines: { orderBy: { lineOrder: 'asc' } },
        shift: { include: { terminal: true } },
      },
    });
    if (!order) throw new AppError(404, 'POS order not found');
    if (order.status === 'POSTED') throw new AppError(400, 'Order already posted');
    if (order.shift.status !== 'OPEN') throw new AppError(400, 'Shift is not open');

    const orderDate = order.createdAt;
    await taxPeriodService.assertOpenForDocumentDate(ctx.companyId, orderDate);

    const isReturn = order.orderType === 'RETURN';

    const fy = await prisma.fiscalYear.findFirst({
      where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
      select: { legacyYearId: true },
    });
    const sourceYearId = fy?.legacyYearId ?? String(orderDate.getUTCFullYear());

    const accounts = await posAccountResolverService.resolveForShiftClose({
      companyId: ctx.companyId,
      safeId: order.shift.terminal.safeId,
      bankAccountId: order.shift.terminal.bankAccountId,
    });

    let totalCogs = 0;

    return prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        const qty = Number(line.quantity);
        const unitCost = await itemCostService.getCostAsOf(
          ctx.companyId,
          line.itemId,
          orderDate,
          tx
        );
        const lineCogs = roundTo4(qty * unitCost);
        totalCogs += lineCogs;

        await stockMovementService.postMovementInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          warehouseId: order.shift.terminal.warehouseId,
          itemId: line.itemId,
          quantityDelta: isReturn ? qty : -qty,
          unitCost,
          movementType: isReturn ? 'POS-RETURN' : 'POS-SALE',
          sourceType: 'POS',
          sourceNumber: order.orderNumber,
          sourceYearId,
          documentDate: orderDate,
        });

        await tx.posOrderLine.update({
          where: { id: line.id },
          data: { unitCost: new Decimal(unitCost) },
        });
      }

      totalCogs = roundTo4(totalCogs);
      const merch = roundTo4(Number(order.totalAmount) - Number(order.discountAmount));
      const tax = roundTo4(Number(order.taxAmount));
      const cash = roundTo4(Number(order.cashAmount));
      const card = roundTo4(Number(order.cardAmount));
      const credit = roundTo4(Number(order.creditAmount));

      const sign = isReturn ? -1 : 1;
      const lines: JournalEntryLineData[] = [];
      let lineOrder = 1;
      const mkLine = (
        accountId: string,
        debit: number,
        credit: number,
        description: string
      ): JournalEntryLineData => ({
        accountId,
        debit: roundTo4(debit),
        credit: roundTo4(credit),
        lineOrder: lineOrder++,
        description,
      });

      // Tender legs (debit on a sale, credit on a return).
      if (cash > 0) {
        lines.push(
          mkLine(
            accounts.cashGlAccountId,
            sign > 0 ? cash : 0,
            sign > 0 ? 0 : cash,
            'POS cash'
          )
        );
      }
      if (card > 0) {
        if (!accounts.bankGlAccountId) {
          throw new AppError(422, 'POS terminal has no bank account configured for card tenders');
        }
        lines.push(
          mkLine(
            accounts.bankGlAccountId,
            sign > 0 ? card : 0,
            sign > 0 ? 0 : card,
            'POS card'
          )
        );
      }
      if (credit > 0) {
        lines.push({
          ...mkLine(
            accounts.arAccountId,
            sign > 0 ? credit : 0,
            sign > 0 ? 0 : credit,
            'POS credit sale'
          ),
          partnerId: order.customerId ?? undefined,
          partnerType: order.customerId ? 'CUSTOMER' : undefined,
        });
      }
      if (totalCogs > 0) {
        lines.push(
          mkLine(
            accounts.cogsAccountId,
            sign > 0 ? totalCogs : 0,
            sign > 0 ? 0 : totalCogs,
            'POS COGS'
          )
        );
      }

      // Revenue/VAT/inventory legs (credit on a sale, debit on a return).
      if (merch > 0) {
        lines.push(
          mkLine(
            accounts.revenueAccountId,
            sign > 0 ? 0 : merch,
            sign > 0 ? merch : 0,
            'POS revenue'
          )
        );
      }
      if (tax > 0) {
        lines.push(
          mkLine(accounts.vatOutputAccountId, sign > 0 ? 0 : tax, sign > 0 ? tax : 0, 'POS VAT')
        );
      }
      if (totalCogs > 0) {
        lines.push(
          mkLine(
            accounts.inventoryAccountId,
            sign > 0 ? 0 : totalCogs,
            sign > 0 ? totalCogs : 0,
            'Inventory relief'
          )
        );
      }

      let journalEntryId: string | undefined;
      if (lines.length > 0) {
        const legacyGlNum = await this.allocateGlNumInTx(tx, ctx);
        const je = await journalPostingService.createAndPostInTx(tx, ctx, {
          fiscalYearId: ctx.fiscalYearId!,
          legacyGlNum,
          date: orderDate,
          description: `POS order ${order.orderNumber}`,
          currencyCode: order.currencyCode,
          entryType: isReturn ? 'POS-RETURN' : 'POS-SALE',
          sourceType: 'POS',
          sourceNumber: order.orderNumber,
          sourceYearId,
          lines,
        });
        journalEntryId = je.id;
      }

      // Tender cash/card now, immediately — the drawer/bank actually moves
      // at order time, not at shift close. Shift close only reconciles.
      if (cash > 0) {
        await tx.safe.update({
          where: { id: order.shift.terminal.safeId },
          data: { balance: { increment: new Decimal(sign * cash) } },
        });
      }
      if (card > 0 && order.shift.terminal.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: order.shift.terminal.bankAccountId },
          data: { balance: { increment: new Decimal(sign * card) } },
        });
      }

      // Shift aggregates are now purely informational (Z-report display) —
      // they no longer drive any GL posting at close.
      await tx.posShift.update({
        where: { id: order.shiftId },
        data: {
          totalCashSales: { increment: new Decimal(sign * cash) },
          totalCardSales: { increment: new Decimal(sign * card) },
          totalCreditSales: { increment: new Decimal(sign * credit) },
          totalMerchandise: { increment: new Decimal(sign * merch) },
          totalTaxAmount: { increment: new Decimal(sign * tax) },
          totalCogs: { increment: new Decimal(sign * totalCogs) },
        },
      });

      if (order.customerId && credit > 0) {
        const delta = isReturn ? -credit : credit;
        await tx.customer.update({
          where: { id: order.customerId },
          data: { balance: { increment: new Decimal(delta) } },
        });
      }

      return tx.posOrder.update({
        where: { id: orderId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedBy: ctx.userId,
          journalEntryId,
        },
        include: { lines: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a POSTED order — dated contra entry against the
   * order JE, reverses the stock movements, the drawer/bank cash movement,
   * the shift's running aggregates, and any customer credit balance impact.
   * Blocked once the shift has been closed, since shift close reconciles
   * against these same aggregates.
   */
  async unpostOrder(ctx: PosPostingContext, orderId: string) {
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      include: { lines: true, shift: { include: { terminal: true } } },
    });
    if (!order) throw new AppError(404, 'POS order not found');
    if (order.status !== 'POSTED') throw new AppError(400, 'Order is not posted');
    if (order.shift.status !== 'OPEN') {
      throw new AppError(400, 'Cannot unpost an order once its shift has been closed');
    }

    const isReturn = order.orderType === 'RETURN';
    const sign = isReturn ? -1 : 1;
    const cash = roundTo4(Number(order.cashAmount));
    const card = roundTo4(Number(order.cardAmount));
    const credit = roundTo4(Number(order.creditAmount));
    const merch = roundTo4(Number(order.totalAmount) - Number(order.discountAmount));
    const tax = roundTo4(Number(order.taxAmount));
    const totalCogs = roundTo4(
      order.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitCost), 0)
    );

    return prisma.$transaction(async (tx) => {
      if (order.journalEntryId) {
        await journalPostingService.reverseJournalEntryInTx(tx, ctx, order.journalEntryId, {
          reason: 'POS order unposted',
        });
      }

      for (const line of order.lines) {
        const qty = Number(line.quantity);
        await stockMovementService.postMovementInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          warehouseId: order.shift.terminal.warehouseId,
          itemId: line.itemId,
          quantityDelta: isReturn ? -qty : qty,
          unitCost: Number(line.unitCost),
          movementType: isReturn ? 'POS-RETURN-REVERSAL' : 'POS-SALE-REVERSAL',
          sourceType: 'POS',
          sourceNumber: order.orderNumber,
          sourceYearId: undefined,
          documentDate: new Date(),
        });
      }

      if (cash > 0) {
        await tx.safe.update({
          where: { id: order.shift.terminal.safeId },
          data: { balance: { increment: new Decimal(-sign * cash) } },
        });
      }
      if (card > 0 && order.shift.terminal.bankAccountId) {
        await tx.bankAccount.update({
          where: { id: order.shift.terminal.bankAccountId },
          data: { balance: { increment: new Decimal(-sign * card) } },
        });
      }

      await tx.posShift.update({
        where: { id: order.shiftId },
        data: {
          totalCashSales: { increment: new Decimal(-sign * cash) },
          totalCardSales: { increment: new Decimal(-sign * card) },
          totalCreditSales: { increment: new Decimal(-sign * credit) },
          totalMerchandise: { increment: new Decimal(-sign * merch) },
          totalTaxAmount: { increment: new Decimal(-sign * tax) },
          totalCogs: { increment: new Decimal(-sign * totalCogs) },
        },
      });

      if (order.customerId && credit > 0) {
        const delta = isReturn ? credit : -credit;
        await tx.customer.update({
          where: { id: order.customerId },
          data: { balance: { increment: new Decimal(delta) } },
        });
      }

      return tx.posOrder.update({
        where: { id: orderId },
        data: {
          status: 'DRAFT',
          postedAt: null,
          postedBy: null,
          journalEntryId: null,
        },
        include: { lines: true },
      });
    });
  }

  async postReturn(ctx: PosPostingContext, orderId: string) {
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId, orderType: 'RETURN' },
    });
    if (!order) throw new AppError(404, 'POS return order not found');
    return this.postOrder(ctx, orderId);
  }
}

export const posOrderPostingService = new PosOrderPostingService();
