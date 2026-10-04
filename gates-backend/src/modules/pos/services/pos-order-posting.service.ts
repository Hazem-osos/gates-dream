import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { inventoryCostingService } from '../../inventory/services/inventory-costing.service';
import { taxPeriodService } from '../../taxes/services/tax-period.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import {
  applyPartnerCardBalancesFromLinesInTx,
  type PostedJournalLineDelta,
} from '../../accounting/services/ledger-balance.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { posAccountResolverService } from './pos-account-resolver.service';
import { authoritativePosTotals, roundTo2 } from '../utils/pos-money';
import { resolvePosLines } from './pos-pricing.service';
import { recordPosAudit } from './pos-audit.service';
import { applyInventoryTrace } from '../../inventory/services/inventory-trace.service';
import {
  paymentColumnTotals,
  paymentCreateData,
  preparePosPayments,
  type PosPaymentDraft,
} from './pos-payment.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { lockShiftRow, assertShiftOpen } from './pos-drawer';
import { consumeReturnApproval, getPosSettings } from './pos-workspace.service';
import { consumeCommercialTenders, consumeCoupon, earnSalePoints, previewCoupon } from './pos-tender-ledger.service';
import type { CreatePosOrderInput, PosOrderLineInput, PosPostingContext } from '../types/pos.types';
import { loadInvoiceTransactionSettings } from '../../invoices/services/invoice-document-type';
import { transactionEnforcesStrictNegativeStock } from '../../inventory/services/strict-inventory';

/** H12 fix: match the invoice tender-split tolerance (was a much looser 0.02). */
const TENDER_TOLERANCE = 0.0001;

/** POS posts with `skipCardColumns` so shared AR/AP accounts do not move the wrong card. */
const POS_SKIP_ACCOUNT_CARD_COLUMNS = true;

async function syncPosPartnerCardCacheInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  journalEntryId: string,
  invert?: boolean
) {
  const lines = await tx.journalEntryLine.findMany({
    where: { journalEntryId },
    orderBy: { lineOrder: 'asc' },
  });
  if (!lines.length) return;
  const deltas: PostedJournalLineDelta[] = lines.map((line) => ({
    accountId: line.accountId,
    debit: line.debit,
    credit: line.credit,
    debitBase: line.debitBase,
    creditBase: line.creditBase,
    partnerId: line.partnerId,
    partnerType: line.partnerType,
  }));
  await applyPartnerCardBalancesFromLinesInTx(tx, companyId, deltas, { invert });
}

function calcLineTotals(lines: CreatePosOrderInput['lines'], headerDiscountPercent?: number | null) {
  // Invoice line math, then 2dp — the scale PosOrder money columns persist.
  // Header discount reduces the net and does not change line VAT (Egyptian default).
  const totals = authoritativePosTotals(lines);
  if (headerDiscountPercent == null || headerDiscountPercent === 0) return totals;
  if (headerDiscountPercent < 0 || headerDiscountPercent > 100) {
    throw new AppError(422, 'POS order discount percent is out of range');
  }
  const headerAmount = roundTo2((totals.merchandise * headerDiscountPercent) / 100);
  return {
    ...totals,
    discountAmount: roundTo2(totals.discountAmount + headerAmount),
    netAmount: roundTo2(totals.netAmount - headerAmount),
  };
}

async function withCoupon(
  companyId: string,
  input: CreatePosOrderInput,
  totals: ReturnType<typeof calcLineTotals>,
  options?: { forgivingCoupon?: boolean }
) {
  if (!input.couponCode || (input.orderType ?? 'SALE') !== 'SALE') {
    return { ...totals, couponId: null as string | null };
  }
  const merchandise = roundTo2(totals.totalAmount - totals.discountAmount);
  try {
    const preview = await previewCoupon(companyId, input.couponCode, input.customerId ?? null, merchandise);
    return {
      ...totals,
      couponId: preview.couponId,
      discountAmount: roundTo2(totals.discountAmount + preview.discount),
      netAmount: roundTo2(totals.netAmount - preview.discount),
    };
  } catch (error) {
    if (options?.forgivingCoupon && error instanceof AppError && error.statusCode === 422) {
      return { ...totals, couponId: null };
    }
    throw error;
  }
}

export class PosOrderPostingService {
  async createOrder(
    companyId: string,
    shiftId: string,
    input: CreatePosOrderInput,
    options?: {
      forceServerPricing?: boolean;
      trustPrice?: boolean;
      trustDiscount?: boolean;
      rejectUnauthorized?: boolean;
      paymentsDeferred?: boolean;
      hold?: boolean;
      userId?: string;
    }
  ) {
    const shift = await prisma.posShift.findFirst({
      where: { id: shiftId, companyId, status: 'OPEN' },
    });
    if (!shift) throw new AppError(404, 'Open POS shift not found');
    if (input.clientRequestId) {
      const existing = await prisma.posOrder.findFirst({
        where: { companyId, clientRequestId: input.clientRequestId },
        include: { lines: { orderBy: { lineOrder: 'asc' } }, payments: true },
      });
      if (existing) return existing;
    }

    const headerDiscountPercent = input.headerDiscountPercent;
    if (
      headerDiscountPercent != null &&
      headerDiscountPercent !== 0 &&
      !options?.trustDiscount &&
      options?.rejectUnauthorized
    ) {
      throw new AppError(403, 'POS manual discount is not permitted');
    }
    const lines =
      options?.forceServerPricing || options?.rejectUnauthorized
        ? await resolvePosLines(companyId, input.customerId, input.lines, {
            trustPrice: Boolean(options?.trustPrice),
            trustDiscount: Boolean(options?.trustDiscount),
            rejectUnauthorized: Boolean(options?.rejectUnauthorized),
          })
        : input.lines;
    const totals = await withCoupon(
      companyId,
      input,
      calcLineTotals(
        lines,
        options?.trustDiscount || !options?.rejectUnauthorized ? headerDiscountPercent : undefined
      )
    );
    if (options?.rejectUnauthorized) {
      const { getPosSettings } = await import('./pos-workspace.service');
      const policy = await getPosSettings(companyId);
      const lineOver =
        policy.discountApprovalPercent != null &&
        lines.some((line) => (line.discountPercent ?? 0) > policy.discountApprovalPercent!);
      const headerOver =
        policy.discountApprovalPercent != null &&
        (input.headerDiscountPercent ?? 0) > policy.discountApprovalPercent;
      if ((lineOver || headerOver) && options.trustDiscount) {
        if (!input.approvalId) throw new AppError(403, 'POS discount needs supervisor approval');
        const approval = await prisma.posApproval.findFirst({
          where: { id: input.approvalId, companyId, action: 'DISCOUNT', status: 'APPROVED' },
        });
        if (!approval || approval.approverId === options.userId) {
          throw new AppError(403, 'POS discount needs supervisor approval');
        }
      }
      if (policy.priceOverrideRequiresApproval && options.trustPrice) {
        const overridden = lines.some((line) => line.listPrice != null && Math.abs(line.price - line.listPrice) > 0.0001);
        if (overridden && !input.approvalId) throw new AppError(403, 'POS price override needs supervisor approval');
      }
    }
    if (!options?.paymentsDeferred) this.validateTenders(input, totals.netAmount);
    if (input.orderType === 'QUOTE' || input.orderType === 'RESERVATION') {
      // These documents are not sales. Tender columns stay zero until conversion.
    }

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.posOrder.create({
        data: {
          companyId,
          shiftId,
          orderNumber: input.orderNumber,
          orderType: input.orderType ?? 'SALE',
          originalOrderId: input.originalOrderId,
          customerId: input.customerId,
          status: 'DRAFT',
          notes: input.notes,
          clientRequestId: input.clientRequestId ?? null,
          headerDiscountPercent:
            headerDiscountPercent != null && (options?.trustDiscount || !options?.rejectUnauthorized)
              ? new Decimal(headerDiscountPercent)
              : null,
          heldAt: options?.hold ? new Date() : null,
          heldBy: options?.hold ? options.userId ?? null : null,
          totalAmount: new Decimal(totals.totalAmount),
          discountAmount: new Decimal(totals.discountAmount),
          taxAmount: new Decimal(totals.taxAmount),
          netAmount: new Decimal(totals.netAmount),
          cashAmount: new Decimal(options?.paymentsDeferred ? 0 : (input.cashAmount ?? 0)),
          cardAmount: new Decimal(options?.paymentsDeferred ? 0 : (input.cardAmount ?? 0)),
          creditAmount: new Decimal(options?.paymentsDeferred ? 0 : (input.creditAmount ?? 0)),
          paymentMethod: input.paymentMethod ?? 'CASH',
          currencyCode: input.currencyCode ?? 'EGP',
          quoteName: input.quoteName ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          couponId: totals.couponId,
        },
      });

      await tx.posOrderLine.createMany({
        data: totals.lines.map((l, index) => ({
          orderId: order.id,
          itemId: l.itemId,
          unitId: l.unitId,
          quantity: new Decimal(l.quantity),
          price: new Decimal(l.price),
          listPrice: l.listPrice != null ? new Decimal(l.listPrice) : null,
          discountPercent: l.discountPercent != null ? new Decimal(l.discountPercent) : null,
          discountAmount: new Decimal(l.lineDiscount ?? 0),
          taxPercent: new Decimal(l.taxPercent ?? 0),
          taxAmount: new Decimal(l.taxAmount),
          lineTotal: new Decimal(l.lineTotal),
          unitCost: new Decimal(0),
          lineOrder: l.lineOrder,
          notes: l.notes ?? input.lines[index]?.notes ?? null,
          originalLineId: input.lines[index]?.originalLineId ?? null,
          isGift: Boolean(l.isGift),
          offerId: l.offerId ?? null,
          batchNumber: l.batchNumber ?? null,
          serialNo: l.serialNo ?? null,
          expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
        })),
      });

      return tx.posOrder.findUnique({
        where: { id: order.id },
        include: { lines: { orderBy: { lineOrder: 'asc' } } },
      });
    });
    if (created && options?.userId) {
      const priceChanges = totals.lines.filter(
        (line) => line.listPrice != null && Math.abs(line.price - line.listPrice) > 0.0001
      );
      if (options.trustPrice && priceChanges.length) {
        await recordPosAudit({
          companyId,
          entityType: 'POS_ORDER',
          entityId: created.id,
          action: 'UPDATED',
          userId: options.userId,
          shiftId,
          before: priceChanges.map((line) => ({ itemId: line.itemId, price: line.listPrice })),
          after: priceChanges.map((line) => ({ itemId: line.itemId, price: line.price })),
          detail: { kind: 'price-override' },
        });
      }
      if (options.trustDiscount && totals.discountAmount > 0) {
        await recordPosAudit({
          companyId,
          entityType: 'POS_ORDER',
          entityId: created.id,
          action: 'UPDATED',
          userId: options.userId,
          shiftId,
          after: { discountAmount: totals.discountAmount, headerDiscountPercent: headerDiscountPercent ?? null },
          detail: { kind: 'discount' },
        });
      }
      if (options.hold) {
        await recordPosAudit({
          companyId,
          entityType: 'POS_ORDER',
          entityId: created.id,
          action: 'HELD',
          userId: options.userId,
          shiftId,
        });
      }
    }
    return created;
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
   * One financial posting per order. The DRAFT → POSTED claim is the first
   * write in the same transaction as costing, the ledger movement, and the
   * journal. A rollback restores DRAFT. A separate committed POSTING status
   * is not used: a crash after that commit and before the financial work
   * would leave the order stuck as posted with no journal.
   *
   * A second call after a successful commit returns the posted order and
   * writes nothing. `activeSourceKey` is only a backstop; it includes the
   * request fiscal year, so the order row is the idempotency guard.
   *
   * Costing goes through `inventoryCostingService`, which already calls
   * `postMovementInTx`. Do not call that again.
   */
  async postOrder(
    ctx: PosPostingContext,
    orderId: string,
    payments?: PosPaymentDraft[],
    options?: { approvalId?: string }
  ) {
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      include: {
        lines: { orderBy: { lineOrder: 'asc' } },
        payments: true,
        shift: { include: { terminal: true } },
      },
    });
    if (!order) throw new AppError(404, 'POS order not found');
    if (order.status === 'POSTED') return order;
    if (order.status !== 'DRAFT') {
      throw new AppError(409, 'POS order cannot be posted from its current state');
    }
    if (order.orderType === 'QUOTE' || order.orderType === 'RESERVATION') {
      throw new AppError(422, 'This document is not posted as a sale');
    }
    if (order.shift.terminal.lockedAt) throw new AppError(423, 'Terminal is locked');
    if (order.shift.status !== 'OPEN') throw new AppError(400, 'Shift is not open');

    const orderDate = order.createdAt;
    await taxPeriodService.assertOpenForDocumentDate(ctx.companyId, orderDate);

    const isReturn = order.orderType === 'RETURN';
    const returnPreview = isReturn ? await this.resolveReturn(prisma, ctx.companyId, order, false) : null;

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

    const policy = await getPosSettings(ctx.companyId);
    const preparedPayments = payments
      ? await preparePosPayments({
          companyId: ctx.companyId,
          netAmount: returnPreview ? returnPreview.totals.netAmount : Number(order.netAmount),
          customerId: returnPreview ? returnPreview.customerId : order.customerId,
          terminalSafeId: order.shift.terminal.safeId,
          terminalBankAccountId: order.shift.terminal.bankAccountId,
          terminalId: order.shift.terminalId,
          branchId: order.shift.terminal.branchId,
          payments,
          arAccountId: accounts.arAccountId,
          liabilityAccounts: {
            GIFT_CARD: policy.giftCardAccountId,
            STORE_CREDIT: policy.storeCreditAccountId,
            POINTS: policy.pointsAccountId,
            EXCHANGE: policy.exchangeClearingAccountId,
            DEPOSIT: policy.depositAccountId,
          },
          cashGlForSafe: (safeId) =>
            treasuryAccountResolverService.resolveSafeGlAccountId(ctx.companyId, safeId),
          bankGlForAccount: (bankAccountId) =>
            treasuryAccountResolverService.resolveBankGlAccountId(ctx.companyId, bankAccountId),
        })
      : null;
    if (!preparedPayments) {
      const net = returnPreview ? returnPreview.totals.netAmount : Number(order.netAmount);
      const storedPaid = roundTo4(
        Number(order.cashAmount) + Number(order.cardAmount) + Number(order.creditAmount)
      );
      if (Math.abs(storedPaid - net) > 0.02 && net > 0) {
        throw new AppError(422, 'POS payment lines are required');
      }
    }

    const warehouseId = order.shift.terminal.warehouseId;
    const stockLines = [...order.lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
    const saleTxSettings = await loadInvoiceTransactionSettings(ctx.companyId, 'SALE');
    const forceStrictNegativeStock = transactionEnforcesStrictNegativeStock(saleTxSettings);

    const posted = await prisma.$transaction(async (tx) => {
      const lockedShift = await lockShiftRow(tx, ctx.companyId, order.shiftId);
      assertShiftOpen(lockedShift?.status);

      let bound = returnPreview;
      if (isReturn) {
        const fresh = await tx.posOrder.findFirst({
          where: { id: orderId, companyId: ctx.companyId },
          include: { lines: { orderBy: { lineOrder: 'asc' } }, payments: true },
        });
        if (fresh?.status === 'POSTED') return fresh;
        if (!fresh || fresh.status !== 'DRAFT') {
          throw new AppError(409, 'POS order cannot be posted from its current state');
        }
        bound = await this.resolveReturn(tx, ctx.companyId, fresh, true);
        const paid = preparedPayments
          ? roundTo2(preparedPayments.reduce((sum, row) => sum + row.amount, 0))
          : roundTo2(Number(fresh.cashAmount) + Number(fresh.cardAmount) + Number(fresh.creditAmount));
        if (Math.abs(paid - bound.totals.netAmount) > 0.001) {
          throw new AppError(422, 'Payment lines must equal the amount due');
        }
        await consumeReturnApproval(tx, ctx.companyId, orderId, options?.approvalId, ctx.userId);
      }
      if (preparedPayments) {
        await consumeCommercialTenders(tx, {
          companyId: ctx.companyId,
          orderId,
          orderType: order.orderType,
          customerId: order.customerId,
          payments: preparedPayments,
        });
      }
      if (!isReturn && order.couponId) {
        await consumeCoupon(tx, ctx.companyId, orderId, order.couponId, order.customerId, Number(order.discountAmount));
      }

      const claimed = await tx.posOrder.updateMany({
        where: { id: orderId, companyId: ctx.companyId, status: 'DRAFT' },
        data: { status: 'POSTED', postedAt: new Date(), postedBy: ctx.userId },
      });
      if (claimed.count !== 1) {
        const current = await tx.posOrder.findFirst({
          where: { id: orderId, companyId: ctx.companyId },
          include: { lines: { orderBy: { lineOrder: 'asc' } }, payments: true },
        });
        if (current?.status === 'POSTED') return current;
        throw new AppError(409, 'POS order cannot be posted from its current state');
      }

      if (bound) {
        for (const line of bound.totals.lines) {
          await tx.posOrderLine.update({
            where: { id: line.returnLineId },
            data: {
              itemId: line.itemId,
              unitId: line.unitId,
              price: new Decimal(line.price),
              discountPercent: line.discountPercent == null ? null : new Decimal(line.discountPercent),
              discountAmount: new Decimal(line.lineDiscount),
              taxPercent: new Decimal(line.taxPercent ?? 0),
              taxAmount: new Decimal(line.taxAmount),
              lineTotal: new Decimal(line.lineTotal),
            },
          });
        }
      }

      let totalCogs = 0;
      const costingLines = bound
        ? bound.totals.lines.map((line) => ({
            id: line.returnLineId,
            itemId: line.itemId,
            quantity: line.quantity,
            unitCost: line.unitCost,
          }))
        : stockLines.map((line) => ({
            id: line.id,
            itemId: line.itemId,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
            batchNumber: line.batchNumber,
            serialNo: line.serialNo,
            expiryDate: line.expiryDate,
          }));
      costingLines.sort((a, b) => a.itemId.localeCompare(b.itemId) || a.id.localeCompare(b.id));
      for (const line of costingLines) {
        const qty = line.quantity;
        const costingBase = {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId,
          itemId: line.itemId,
          sourceType: 'POS',
          sourceNumber: order.orderNumber,
          sourceYearId,
          sourceDocumentId: order.id,
          transactionDate: orderDate,
          updateLastPurchasePrice: false as const,
        };

        let unitCost: number;
        let lineCogs: number;
        if (isReturn) {
          const inbound = await inventoryCostingService.applyInboundMovement(tx, {
            ...costingBase,
            quantity: qty,
            unitCost: line.unitCost,
            inheritCurrentCost: false,
            movementType: 'POS-RETURN',
          });
          unitCost = inbound.unitCost;
          lineCogs = inbound.totalValuation;
        } else {
          const outbound = await inventoryCostingService.applyOutboundMovement(tx, {
            ...costingBase,
            quantity: qty,
            movementType: 'POS-SALE',
            ...(forceStrictNegativeStock ? { forceStrictNegativeCheck: true } : {}),
          });
          unitCost = outbound.unitCost;
          lineCogs = outbound.totalValuation;
        }
        if ('batchNumber' in line || 'serialNo' in line) {
          await applyInventoryTrace(tx, {
            companyId: ctx.companyId,
            itemId: line.itemId,
            warehouseId,
            quantity: qty,
            lineId: line.id,
            batchNumber: 'batchNumber' in line && typeof line.batchNumber === 'string' ? line.batchNumber : null,
            serialNo: 'serialNo' in line && typeof line.serialNo === 'string' ? line.serialNo : null,
            expiryDate: 'expiryDate' in line && line.expiryDate instanceof Date ? line.expiryDate : null,
            direction: isReturn ? 'IN' : 'OUT',
          });
        }
        totalCogs += lineCogs;

        await tx.posOrderLine.update({
          where: { id: line.id },
          data: { unitCost: new Decimal(unitCost) },
        });
      }

      if (!isReturn && policy.pointsAccountId) {
        const points = roundTo2(Number(order.netAmount) * Number(policy.pointsPerAmount ?? 0));
        if (order.customerId && points > 0) {
          await earnSalePoints(tx, ctx.companyId, orderId, order.customerId, Number(order.netAmount), Number(policy.pointsPerAmount));
          await journalPostingService.createAndPostInTx(tx, ctx, {
            fiscalYearId: ctx.fiscalYearId!,
            legacyGlNum: await documentSequenceService.nextGlNumberInTx(tx, ctx),
            date: orderDate,
            description: `POS points ${order.orderNumber}`,
            currencyCode: 'EGP',
            entryType: 'POS-POINTS',
            sourceType: 'POS-POINTS',
            sourceNumber: order.orderNumber.slice(0, 30),
            sourceYearId,
            lines: [
              { accountId: accounts.revenueAccountId, debit: points, credit: 0, lineOrder: 1, description: 'POS points contra revenue' },
              { accountId: policy.pointsAccountId, debit: 0, credit: points, lineOrder: 2, description: 'POS points liability' },
            ],
          });
        }
      }

      if (preparedPayments) {
        await tx.posPayment.deleteMany({ where: { orderId, companyId: ctx.companyId } });
        if (preparedPayments.length) {
          await tx.posPayment.createMany({
            data: paymentCreateData(ctx.companyId, orderId, preparedPayments),
          });
        }
      }

      totalCogs = roundTo4(totalCogs);
      const merch = bound
        ? bound.totals.merchandise
        : roundTo4(Number(order.totalAmount) - Number(order.discountAmount));
      const tax = bound ? bound.totals.taxAmount : roundTo4(Number(order.taxAmount));
      const customerId = bound ? bound.customerId : order.customerId;
      const columns = preparedPayments
        ? paymentColumnTotals(preparedPayments)
        : {
            cash: roundTo4(Number(order.cashAmount)),
            card: roundTo4(Number(order.cardAmount)),
            credit: roundTo4(Number(order.creditAmount)),
            paymentMethod: order.paymentMethod,
          };
      const cash = columns.cash;
      const card = columns.card;
      const credit = columns.credit;

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
        if (preparedPayments) {
          const byGl = new Map<string, number>();
          for (const payment of preparedPayments) {
            if (payment.settlementType !== 'CASH') continue;
            byGl.set(payment.glAccountId, roundTo4((byGl.get(payment.glAccountId) ?? 0) + payment.amount));
          }
          for (const [accountId, amount] of byGl) {
            lines.push(mkLine(accountId, sign > 0 ? amount : 0, sign > 0 ? 0 : amount, 'POS cash'));
          }
        } else {
          lines.push(
            mkLine(
              accounts.cashGlAccountId,
              sign > 0 ? cash : 0,
              sign > 0 ? 0 : cash,
              'POS cash'
            )
          );
        }
      }
      if (card > 0) {
        if (preparedPayments) {
          const byGl = new Map<string, number>();
          for (const payment of preparedPayments) {
            if (payment.settlementType !== 'BANK') continue;
            byGl.set(payment.glAccountId, roundTo4((byGl.get(payment.glAccountId) ?? 0) + payment.amount));
          }
          for (const [accountId, amount] of byGl) {
            lines.push(
              mkLine(accountId, sign > 0 ? amount : 0, sign > 0 ? 0 : amount, 'POS bank tender')
            );
          }
        } else {
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
      }
      if (credit > 0) {
        lines.push({
          ...mkLine(
            accounts.arAccountId,
            sign > 0 ? credit : 0,
            sign > 0 ? 0 : credit,
            'POS credit sale'
          ),
          partnerId: customerId ?? undefined,
          partnerType: customerId ? 'CUSTOMER' : undefined,
        });
      }
      if (preparedPayments) {
        const byGl = new Map<string, number>();
        for (const payment of preparedPayments) {
          if (payment.settlementType === 'CASH' || payment.settlementType === 'BANK' || payment.settlementType === 'CREDIT') continue;
          byGl.set(payment.glAccountId, roundTo4((byGl.get(payment.glAccountId) ?? 0) + payment.amount));
        }
        for (const [accountId, amount] of byGl) {
          lines.push(mkLine(accountId, sign > 0 ? amount : 0, sign > 0 ? 0 : amount, 'POS liability tender'));
        }
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
          skipCardColumns: POS_SKIP_ACCOUNT_CARD_COLUMNS,
        });
        journalEntryId = je.id;
        await syncPosPartnerCardCacheInTx(tx, ctx.companyId, je.id);
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

      return tx.posOrder.update({
        where: { id: orderId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedBy: ctx.userId,
          heldAt: null,
          heldBy: null,
          customerId,
          totalAmount: bound ? new Decimal(bound.totals.totalAmount) : undefined,
          discountAmount: bound ? new Decimal(bound.totals.discountAmount) : undefined,
          taxAmount: bound ? new Decimal(bound.totals.taxAmount) : undefined,
          netAmount: bound ? new Decimal(bound.totals.netAmount) : undefined,
          journalEntryId,
          cashAmount: new Decimal(cash),
          cardAmount: new Decimal(card),
          creditAmount: new Decimal(credit),
          paymentMethod: columns.paymentMethod,
        },
        include: { lines: true, payments: true },
      });
    });
    await recordPosAudit({
      companyId: ctx.companyId,
      entityType: 'POS_ORDER',
      entityId: orderId,
      action: 'POSTED',
      userId: ctx.userId,
      terminalId: order.shift.terminalId,
      shiftId: order.shiftId,
      after: {
        orderType: order.orderType,
        netAmount: Number(posted.netAmount),
        orderNumber: order.orderNumber,
      },
      detail: { kind: isReturn ? 'return' : 'sale', approvalId: options?.approvalId ?? null },
    });
    return posted;
  }

  /**
   * Terminal cancellation. The posted order stays as history with status VOIDED.
   * The original journal is unposted in place (no contra row). Stock, lots, serials,
   * drawer aggregates, and partner card caches move back. Payments stay on the order.
   * Unpost is different: it returns the order to DRAFT and clears the journal link.
   * A customer refund is a linked RETURN, not a void.
   */
  async voidOrder(ctx: PosPostingContext, orderId: string, reason: string) {
    const why = reason.trim();
    if (!why) throw new AppError(422, 'POS void needs a reason');
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      include: { lines: true, shift: { include: { terminal: true } }, payments: true },
    });
    if (!order) throw new AppError(404, 'POS order not found');
    if (order.status === 'VOIDED') {
      return order;
    }
    if (order.status !== 'POSTED') throw new AppError(400, 'Only a posted POS order can be voided');
    if (order.shift.status !== 'OPEN') {
      throw new AppError(400, 'Cannot void an order once its shift has been closed');
    }
    if (order.orderType === 'SALE') {
      const later = await prisma.posOrder.count({
        where: { companyId: ctx.companyId, originalOrderId: order.id, orderType: 'RETURN', status: 'POSTED' },
      });
      if (later > 0) throw new AppError(422, 'Void the posted returns before voiding the sale');
    }

    const isReturn = order.orderType === 'RETURN';
    const sign = isReturn ? -1 : 1;
    const cash = roundTo4(Number(order.cashAmount));
    const card = roundTo4(Number(order.cardAmount));
    const credit = roundTo4(Number(order.creditAmount));
    const merch = roundTo4(Number(order.totalAmount) - Number(order.discountAmount));
    const tax = roundTo4(Number(order.taxAmount));
    const totalCogs = roundTo4(order.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitCost), 0));

    const voided = await prisma.$transaction(async (tx) => {
      const lockedShift = await lockShiftRow(tx, ctx.companyId, order.shiftId);
      assertShiftOpen(lockedShift?.status);
      const claim = await tx.posOrder.updateMany({
        where: { id: orderId, companyId: ctx.companyId, status: 'POSTED' },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidedBy: ctx.userId,
          voidReason: why,
        },
      });
      if (claim.count === 0) {
        const current = await tx.posOrder.findFirst({ where: { id: orderId, companyId: ctx.companyId }, include: { lines: true, payments: true } });
        if (current?.status === 'VOIDED') return current;
        throw new AppError(400, 'Only a posted POS order can be voided');
      }

      let voidJournalEntryId: string | undefined;
      if (order.journalEntryId) {
        const journalEntryId = order.journalEntryId;
        await journalPostingService.reverseJournalEntryInTx(tx, ctx, journalEntryId, {
          reason: why,
          skipCardColumns: POS_SKIP_ACCOUNT_CARD_COLUMNS,
        });
        await syncPosPartnerCardCacheInTx(tx, ctx.companyId, journalEntryId, true);
        await tx.journalEntry.update({
          where: { id: journalEntryId },
          data: { isCancelled: true },
        });
        voidJournalEntryId = journalEntryId;
      }

      const fy = await tx.fiscalYear.findFirst({
        where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
        select: { legacyYearId: true },
      });
      const sourceYearId = fy?.legacyYearId ?? String(new Date().getUTCFullYear());
      const stockLines = [...order.lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
      for (const line of stockLines) {
        const qty = Number(line.quantity);
        const costingBase = {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId: order.shift.terminal.warehouseId,
          itemId: line.itemId,
          sourceType: 'POS-VOID',
          sourceNumber: order.orderNumber,
          sourceYearId,
          sourceDocumentId: order.id,
          transactionDate: new Date(),
          updateLastPurchasePrice: false as const,
        };
        if (isReturn) {
          await inventoryCostingService.reverseInboundInTx(tx, {
            ...costingBase,
            quantity: qty,
            originalUnitCost: Number(line.unitCost),
            movementType: 'POS-RETURN-VOID',
          });
        } else {
          await inventoryCostingService.applyInboundMovement(tx, {
            ...costingBase,
            quantity: qty,
            unitCost: Number(line.unitCost),
            inheritCurrentCost: false,
            movementType: 'POS-SALE-VOID',
          });
        }
        await applyInventoryTrace(tx, {
          companyId: ctx.companyId,
          itemId: line.itemId,
          warehouseId: order.shift.terminal.warehouseId,
          quantity: qty,
          lineId: line.id,
          batchNumber: line.batchNumber,
          serialNo: line.serialNo,
          expiryDate: line.expiryDate,
          direction: isReturn ? 'OUT' : 'IN',
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
      return tx.posOrder.update({
        where: { id: orderId },
        data: { voidJournalEntryId },
        include: { lines: true, payments: true },
      });
    });

    await recordPosAudit({
      companyId: ctx.companyId,
      entityType: 'POS_ORDER',
      entityId: orderId,
      action: 'CANCELLED',
      userId: ctx.userId,
      terminalId: order.shift.terminalId,
      shiftId: order.shiftId,
      reason: why,
      before: { status: 'POSTED', netAmount: Number(order.netAmount) },
      after: { status: 'VOIDED' },
      detail: { kind: 'void' },
    });
    return voided;
  }

  /**
   * Wave 2 fix: reverses a POSTED order — unposts the order JE in place (no
   * contra row), reverses stock, shift aggregates, and partner card caches.
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

    const unposted = await prisma.$transaction(async (tx) => {
      const lockedShift = await lockShiftRow(tx, ctx.companyId, order.shiftId);
      assertShiftOpen(lockedShift?.status);

      // The status check above runs outside this transaction; claim the row
      // first so a concurrent unpost stops before reversing anything.
      const claimUnpost = await tx.posOrder.updateMany({
        where: { id: orderId, companyId: ctx.companyId, status: 'POSTED' },
        data: { status: 'DRAFT', postedAt: null, postedBy: null },
      });
      if (claimUnpost.count === 0) {
        throw new AppError(400, 'Order is not posted');
      }

      if (order.journalEntryId) {
        const journalEntryId = order.journalEntryId;
        await journalPostingService.reverseJournalEntryInTx(tx, ctx, journalEntryId, {
          reason: 'POS order unposted',
          skipCardColumns: POS_SKIP_ACCOUNT_CARD_COLUMNS,
        });
        await syncPosPartnerCardCacheInTx(tx, ctx.companyId, journalEntryId, true);
      }

      const fy = await tx.fiscalYear.findFirst({
        where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
        select: { legacyYearId: true },
      });
      const sourceYearId = fy?.legacyYearId ?? String(new Date().getUTCFullYear());
      const stockLines = [...order.lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
      for (const line of stockLines) {
        const qty = Number(line.quantity);
        const costingBase = {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? undefined,
          warehouseId: order.shift.terminal.warehouseId,
          itemId: line.itemId,
          sourceType: 'POS',
          sourceNumber: order.orderNumber,
          sourceYearId,
          sourceDocumentId: order.id,
          transactionDate: new Date(),
          updateLastPurchasePrice: false as const,
        };
        if (isReturn) {
          await inventoryCostingService.reverseInboundInTx(tx, {
            ...costingBase,
            quantity: qty,
            originalUnitCost: Number(line.unitCost),
            movementType: 'POS-RETURN-REVERSAL',
          });
        } else {
          await inventoryCostingService.applyInboundMovement(tx, {
            ...costingBase,
            quantity: qty,
            unitCost: Number(line.unitCost),
            inheritCurrentCost: false,
            movementType: 'POS-SALE-REVERSAL',
          });
        }
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

      await tx.posPayment.deleteMany({ where: { orderId, companyId: ctx.companyId } });

      return tx.posOrder.update({
        where: { id: orderId },
        data: { journalEntryId: null },
        include: { lines: true },
      });
    });
    await recordPosAudit({
      companyId: ctx.companyId,
      entityType: 'POS_ORDER',
      entityId: orderId,
      action: 'UNPOSTED',
      userId: ctx.userId,
      terminalId: order.shift.terminalId,
      shiftId: order.shiftId,
      before: { status: 'POSTED', netAmount: Number(order.netAmount) },
      after: { status: 'DRAFT' },
    });
    return unposted;
  }

  async quote(
    companyId: string,
    input: CreatePosOrderInput,
    flags?: {
      trustPrice?: boolean;
      trustDiscount?: boolean;
      rejectUnauthorized?: boolean;
      forgivingCoupon?: boolean;
    }
  ) {
    const header = flags?.trustDiscount ? input.headerDiscountPercent : undefined;
    if (
      input.headerDiscountPercent &&
      !flags?.trustDiscount &&
      flags?.rejectUnauthorized
    ) {
      throw new AppError(403, 'POS manual discount is not permitted');
    }
    const lines = await resolvePosLines(companyId, input.customerId, input.lines, {
      trustPrice: Boolean(flags?.trustPrice),
      trustDiscount: Boolean(flags?.trustDiscount),
      rejectUnauthorized: Boolean(flags?.rejectUnauthorized),
    });
    return withCoupon(companyId, input, calcLineTotals(lines, header), {
      forgivingCoupon: Boolean(flags?.forgivingCoupon),
    });
  }

  async updateDraft(
    companyId: string,
    orderId: string,
    input: CreatePosOrderInput,
    options?: {
      hold?: boolean;
      userId?: string;
      trustPrice?: boolean;
      trustDiscount?: boolean;
      rejectUnauthorized?: boolean;
    }
  ) {
    const existing = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId, status: 'DRAFT' },
    });
    if (!existing) throw new AppError(404, 'Draft POS order not found');
    if (
      input.headerDiscountPercent &&
      !options?.trustDiscount &&
      options?.rejectUnauthorized
    ) {
      throw new AppError(403, 'POS manual discount is not permitted');
    }
    const lines = await resolvePosLines(
      companyId,
      input.customerId ?? existing.customerId,
      input.lines,
      {
        trustPrice: Boolean(options?.trustPrice),
        trustDiscount: Boolean(options?.trustDiscount),
        rejectUnauthorized: Boolean(options?.rejectUnauthorized),
      }
    );
    const totals = await withCoupon(
      companyId,
      input,
      calcLineTotals(lines, options?.trustDiscount ? input.headerDiscountPercent : undefined)
    );
    return prisma.$transaction(async (tx) => {
      await tx.posOrderLine.deleteMany({ where: { orderId } });
      await tx.posOrderLine.createMany({
        data: totals.lines.map((l, index) => ({
          orderId,
          itemId: l.itemId,
          unitId: l.unitId,
          quantity: new Decimal(l.quantity),
          price: new Decimal(l.price),
          listPrice: l.listPrice != null ? new Decimal(l.listPrice) : null,
          discountPercent: l.discountPercent != null ? new Decimal(l.discountPercent) : null,
          discountAmount: new Decimal(l.lineDiscount ?? 0),
          taxPercent: new Decimal(l.taxPercent ?? 0),
          taxAmount: new Decimal(l.taxAmount),
          lineTotal: new Decimal(l.lineTotal),
          unitCost: new Decimal(0),
          lineOrder: l.lineOrder,
          notes: l.notes ?? input.lines[index]?.notes ?? null,
          isGift: Boolean(l.isGift),
          offerId: l.offerId ?? null,
          batchNumber: l.batchNumber ?? null,
          serialNo: l.serialNo ?? null,
          expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
        })),
      });
      return tx.posOrder.update({
        where: { id: orderId },
        data: {
          customerId: input.customerId ?? existing.customerId,
          notes: input.notes ?? existing.notes,
          headerDiscountPercent:
            options?.trustDiscount && input.headerDiscountPercent != null
              ? new Decimal(input.headerDiscountPercent)
              : existing.headerDiscountPercent,
          totalAmount: new Decimal(totals.totalAmount),
          discountAmount: new Decimal(totals.discountAmount),
          taxAmount: new Decimal(totals.taxAmount),
          netAmount: new Decimal(totals.netAmount),
          couponId: input.couponCode ? totals.couponId : input.couponCode === '' ? null : existing.couponId,
          heldAt: options?.hold ? new Date() : existing.heldAt,
          heldBy: options?.hold ? options.userId ?? existing.heldBy : existing.heldBy,
        },
        include: { lines: { orderBy: { lineOrder: 'asc' } }, payments: true },
      });
    });
  }

  async listHeld(companyId: string, shiftId: string) {
    return prisma.posOrder.findMany({
      where: { companyId, shiftId, status: 'DRAFT', orderType: 'SALE', heldAt: { not: null } },
      include: { lines: { orderBy: { lineOrder: 'asc' }, include: { item: { select: { arabicName: true } } } }, customer: { select: { id: true, arabicName: true } } },
      orderBy: { heldAt: 'desc' },
      take: 30,
    });
  }

  async holdOrder(companyId: string, orderId: string, userId?: string) {
    const updated = await prisma.posOrder.updateMany({
      where: { id: orderId, companyId, status: 'DRAFT' },
      data: { heldAt: new Date(), heldBy: userId ?? null },
    });
    if (updated.count !== 1) throw new AppError(404, 'Draft POS order not found');
    const held = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' }, include: { item: { select: { arabicName: true } } } }, customer: { select: { id: true, arabicName: true } } },
    });
    await recordPosAudit({
      companyId,
      entityType: 'POS_ORDER',
      entityId: orderId,
      action: 'HELD',
      userId,
      shiftId: held?.shiftId,
    });
    return held;
  }

  async resumeHeld(companyId: string, orderId: string, userId?: string) {
    const updated = await prisma.posOrder.updateMany({
      where: { id: orderId, companyId, status: 'DRAFT', heldAt: { not: null } },
      data: { heldAt: null, heldBy: null },
    });
    if (updated.count !== 1) throw new AppError(404, 'Held POS order not found');
    await recordPosAudit({
      companyId,
      entityType: 'POS_ORDER',
      entityId: orderId,
      action: 'RESUMED',
      userId,
    });
    return prisma.posOrder.findFirst({
      where: { id: orderId, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' }, include: { item: { select: { arabicName: true } } } }, payments: true, customer: true },
    });
  }

  async receipt(companyId: string, orderId: string) {
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId, status: { in: ['POSTED', 'VOIDED'] } },
      include: {
        lines: { orderBy: { lineOrder: 'asc' }, include: { item: { select: { arabicName: true } } } },
        payments: true,
        customer: { select: { arabicName: true } },
        originalOrder: { select: { orderNumber: true, postedAt: true } },
        shift: { include: { terminal: { include: { branch: { select: { arabicName: true } } } } } },
        company: { select: { arabicName: true } },
      },
    });
    if (!order) throw new AppError(404, 'Posted POS order not found');
    const tendered = order.payments.reduce((sum, row) => sum + Number(row.tenderedAmount ?? row.amount), 0);
    const change = order.payments.reduce((sum, row) => sum + Number(row.changeAmount ?? 0), 0);
    const isReturn = order.orderType === 'RETURN';
    return {
      orderType: order.orderType,
      status: order.status,
      voidReason: order.voidReason,
      title: order.status === 'VOIDED' ? 'إيصال إلغاء' : isReturn ? 'إيصال مرتجع' : 'إيصال بيع',
      companyName: order.company.arabicName,
      branchName: order.shift.terminal.branch.arabicName,
      terminalName: order.shift.terminal.name,
      orderNumber: order.orderNumber,
      postedAt: order.postedAt,
      cashier: order.postedBy,
      customerName: order.customer?.arabicName ?? null,
      originalOrderNumber: order.originalOrder?.orderNumber ?? null,
      originalPostedAt: order.originalOrder?.postedAt ?? null,
      notes: order.notes,
      subtotal: Number(order.totalAmount),
      discount: Number(order.discountAmount),
      tax: Number(order.taxAmount),
      net: Number(order.netAmount),
      lines: order.lines.map((line) => ({
        name: line.item.arabicName,
        quantity: Number(line.quantity),
        price: Number(line.price),
        listPrice: line.listPrice == null ? null : Number(line.listPrice),
        total: Number(line.lineTotal),
        isGift: line.isGift,
      })),
      payments: order.payments.map((row) => ({
        method: row.method,
        label: row.methodLabel || row.method,
        amount: Number(row.amount),
        tenderedAmount: row.tenderedAmount == null ? null : Number(row.tenderedAmount),
        changeAmount: row.changeAmount == null ? null : Number(row.changeAmount),
        referenceNumber: row.referenceNumber,
      })),
      tendered,
      change,
    };
  }

  async reprint(companyId: string, orderId: string, userId: string) {
    const data = await this.receipt(companyId, orderId);
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId },
      select: { shiftId: true, shift: { select: { terminalId: true } } },
    });
    await recordPosAudit({
      companyId,
      entityType: 'POS_ORDER',
      entityId: orderId,
      action: 'REPRINTED',
      userId,
      shiftId: order?.shiftId,
      terminalId: order?.shift.terminalId,
      detail: { orderNumber: data.orderNumber, orderType: data.orderType },
    });
    return data;
  }

  async postReturn(ctx: PosPostingContext, orderId: string, payments?: PosPaymentDraft[]) {
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId, orderType: 'RETURN' },
    });
    if (!order) throw new AppError(404, 'POS return order not found');
    return this.postOrder(ctx, orderId, payments);
  }

  async findPostedSale(companyId: string, orderNumber: string) {
    const order = await prisma.posOrder.findFirst({
      where: { companyId, orderNumber, status: 'POSTED', orderType: 'SALE' },
      include: {
        lines: {
          orderBy: { lineOrder: 'asc' },
          include: { item: { select: { arabicName: true } } },
        },
        customer: { select: { id: true, arabicName: true } },
        payments: true,
        shift: { select: { id: true, status: true, terminalId: true } },
      },
    });
    if (!order) throw new AppError(404, 'Posted POS sale not found');
    const priorLines = await prisma.posOrderLine.findMany({
      where: {
        originalLineId: { in: order.lines.map((line) => line.id) },
        order: { companyId, status: 'POSTED', orderType: 'RETURN' },
      },
      select: { originalLineId: true, quantity: true },
    });
    const used = new Map<string, number>();
    for (const line of priorLines) {
      if (!line.originalLineId) continue;
      used.set(line.originalLineId, (used.get(line.originalLineId) ?? 0) + Number(line.quantity));
    }
    return {
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        soldQuantity: Number(line.quantity),
        returnedQuantity: used.get(line.id) ?? 0,
        remainingQuantity: Number(line.quantity) - (used.get(line.id) ?? 0),
      })),
    };
  }

  async createReturn(
    ctx: PosPostingContext,
    input: {
      shiftId: string;
      originalOrderId: string;
      notes?: string;
      lines: Array<{ originalLineId: string; quantity: number }>;
    }
  ) {
    const original = await prisma.posOrder.findFirst({
      where: { id: input.originalOrderId, companyId: ctx.companyId, status: 'POSTED', orderType: 'SALE' },
      include: { lines: true },
    });
    if (!original) throw new AppError(404, 'Posted POS sale not found');
    const byId = new Map(original.lines.map((line) => [line.id, line]));
    if (!input.lines.length) throw new AppError(422, 'POS return needs at least one line');
    const seen = new Set<string>();
    const lines = input.lines.map((requested, index) => {
      if (seen.has(requested.originalLineId)) {
        throw new AppError(422, 'POS return line is duplicated');
      }
      seen.add(requested.originalLineId);
      const source = byId.get(requested.originalLineId);
      if (!source) throw new AppError(422, 'POS return line must reference the original sold line');
      if (!(requested.quantity > 0)) throw new AppError(422, 'Return quantity must be greater than zero');
      const sold = Number(source.quantity);
      const ratio = requested.quantity / sold;
      return {
        itemId: source.itemId,
        unitId: source.unitId,
        quantity: requested.quantity,
        price: Number(source.price),
        discountPercent: source.discountPercent == null ? undefined : Number(source.discountPercent),
        discountAmount:
          source.discountPercent == null ? roundTo2(Number(source.discountAmount) * ratio) : undefined,
        taxPercent: Number(source.taxPercent),
        lineOrder: index + 1,
        originalLineId: source.id,
      };
    });
    return this.createOrder(
      ctx.companyId,
      input.shiftId,
      {
        orderNumber: `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderType: 'RETURN',
        originalOrderId: original.id,
        customerId: original.customerId ?? undefined,
        notes: input.notes,
        lines,
      },
      { paymentsDeferred: true }
    );
  }

  /**
   * A return posts only when every line points at a posted sale line in this
   * company. Price, tax, discount, cost, and customer come from that sale.
   * The original sale row is locked so two returns cannot both pass the
   * quantity cap. Call this before the DRAFT → POSTED claim.
   */
  private async resolveReturn(
    db: Prisma.TransactionClient | typeof prisma,
    companyId: string,
    order: {
      id: string;
      originalOrderId: string | null;
      lines: Array<{
        id: string;
        itemId: string;
        unitId: string;
        quantity: Prisma.Decimal | number;
        originalLineId: string | null;
        lineOrder: number;
      }>;
    },
    lock: boolean
  ) {
    if (!order.lines.length) throw new AppError(422, 'POS return needs at least one line');
    if (!order.originalOrderId) throw new AppError(422, 'POS return requires a posted original sale');

    if (lock) {
      const locked = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM pos_orders
        WHERE id = ${order.originalOrderId} AND companyId = ${companyId}
          AND status = 'POSTED' AND orderType = 'SALE'
        FOR UPDATE
      `;
      if (!locked.length) throw new AppError(422, 'POS return requires a posted original sale');
    } else {
      const found = await db.posOrder.findFirst({
        where: { id: order.originalOrderId, companyId, status: 'POSTED', orderType: 'SALE' },
        select: { id: true },
      });
      if (!found) throw new AppError(422, 'POS return requires a posted original sale');
    }

    const original = await db.posOrder.findFirst({
      where: { id: order.originalOrderId, companyId, status: 'POSTED', orderType: 'SALE' },
      select: {
        customerId: true,
        lines: {
          select: {
            id: true,
            itemId: true,
            unitId: true,
            quantity: true,
            price: true,
            discountPercent: true,
            discountAmount: true,
            taxPercent: true,
            unitCost: true,
          },
        },
      },
    });
    if (!original) throw new AppError(422, 'POS return requires a posted original sale');

    const byId = new Map(original.lines.map((line) => [line.id, line]));
    const prior = await db.posOrderLine.findMany({
      where: {
        originalLineId: { in: original.lines.map((line) => line.id) },
        order: { companyId, status: 'POSTED', orderType: 'RETURN', id: { not: order.id } },
      },
      select: { originalLineId: true, quantity: true },
    });
    const used = new Map<string, number>();
    for (const line of prior) {
      if (!line.originalLineId) continue;
      used.set(line.originalLineId, (used.get(line.originalLineId) ?? 0) + Number(line.quantity));
    }

    const seen = new Set<string>();
    const inputs: Array<PosOrderLineInput & { returnLineId: string; unitCost: number }> = [];
    for (const line of order.lines) {
      const qty = Number(line.quantity);
      if (!(qty > 0)) throw new AppError(422, 'Return quantity must be greater than zero');
      if (!line.originalLineId) throw new AppError(422, 'POS return line must reference the original sold line');
      if (seen.has(line.originalLineId)) throw new AppError(422, 'POS return line is duplicated');
      seen.add(line.originalLineId);
      const source = byId.get(line.originalLineId);
      if (!source) throw new AppError(422, 'POS return line must reference the original sold line');
      if (line.itemId !== source.itemId || line.unitId !== source.unitId) {
        throw new AppError(422, 'POS return item does not match the original sold line');
      }
      const sold = Number(source.quantity);
      const already = (used.get(source.id) ?? 0) + qty;
      if (already > sold + 0.0001) {
        throw new AppError(422, 'Returned quantity exceeds the quantity sold');
      }
      used.set(source.id, already);
      const ratio = sold === 0 ? 0 : qty / sold;
      inputs.push({
        returnLineId: line.id,
        unitCost: Number(source.unitCost),
        itemId: source.itemId,
        unitId: source.unitId,
        quantity: qty,
        price: Number(source.price),
        discountPercent: source.discountPercent == null ? undefined : Number(source.discountPercent),
        discountAmount:
          source.discountPercent == null ? roundTo2(Number(source.discountAmount) * ratio) : undefined,
        taxPercent: Number(source.taxPercent),
        lineOrder: line.lineOrder,
        originalLineId: source.id,
      });
    }

    const totals = authoritativePosTotals(inputs);
    return {
      customerId: original.customerId,
      totals: {
        ...totals,
        lines: totals.lines.map((line, index) => ({
          ...line,
          returnLineId: inputs[index].returnLineId,
          unitCost: inputs[index].unitCost,
        })),
      },
    };
  }
}

export const posOrderPostingService = new PosOrderPostingService();
