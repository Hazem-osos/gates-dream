import { randomUUID } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { emailService } from '../../../shared/services/email.service';
import { itemReservationService } from '../../inventory/services/item-reservation.service';
import { itemOfferService } from '../../inventory/services/item-offer.service';
import { isCompanyWhatsappReady, sendCompanyTemplate } from '../../whatsapp/whatsapp-connection.service';
import { posOrderPostingService } from './pos-order-posting.service';
import { posCashMovementService } from './pos-cash-movement.service';
import { getPosSettings } from './pos-workspace.service';
import { recordPosAudit } from './pos-audit.service';
import { exchangeSplit } from './pos-commercial-math';
import { roundTo2 } from '../utils/pos-money';
import type { CreatePosOrderInput, PosPostingContext } from '../types/pos.types';
import type { PosPaymentDraft } from './pos-payment.service';

const RESERVATION_REASON = (orderId: string) => `POS-RESERVATION:${orderId}`;

type PricingFlags = { trustPrice: boolean; trustDiscount: boolean };

function requiredOrder<T>(order: T | null | undefined): T {
  if (order == null) throw new AppError(500, 'POS document was not created');
  return order;
}

function pricingOptions(flags: PricingFlags) {
  return {
    forceServerPricing: true,
    rejectUnauthorized: true,
    trustPrice: flags.trustPrice,
    trustDiscount: flags.trustDiscount,
    paymentsDeferred: true,
  };
}

async function requireLiability(companyId: string, field: 'giftCardAccountId' | 'depositAccountId' | 'exchangeClearingAccountId' | 'storeCreditAccountId') {
  const settings = await getPosSettings(companyId);
  const accountId = settings[field];
  if (!accountId) throw new AppError(422, 'POS liability account is not configured');
  return { settings, accountId };
}

export class PosCommercialService {
  async saveQuote(companyId: string, shiftId: string, input: CreatePosOrderInput, flags: PricingFlags, userId: string) {
    if (!input.quoteName?.trim()) throw new AppError(422, 'Quote name is required');
    if (!input.expiresAt) throw new AppError(422, 'Quote expiry is required');
    const expires = new Date(input.expiresAt);
    if (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now()) {
      throw new AppError(422, 'Quote expiry must be in the future');
    }
    const order = requiredOrder(await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      {
        ...input,
        orderNumber: input.orderNumber || `QUO-${Date.now()}`,
        orderType: 'QUOTE',
        quoteName: input.quoteName.trim(),
        expiresAt: expires.toISOString(),
      },
      { ...pricingOptions(flags), userId }
    ));
    await recordPosAudit({
      companyId,
      entityType: 'POS_ORDER',
      entityId: order.id,
      action: 'CREATED',
      userId,
      shiftId,
    });
    return order;
  }

  listQuotes(companyId: string) {
    return prisma.posOrder.findMany({
      where: { companyId, orderType: 'QUOTE', status: 'DRAFT', convertedToOrderId: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        lines: { orderBy: { lineOrder: 'asc' }, include: { item: { select: { arabicName: true } } } },
        customer: { select: { id: true, arabicName: true } },
      },
    });
  }

  async convertQuote(companyId: string, quoteId: string, shiftId: string, flags: PricingFlags, userId: string) {
    const quote = await prisma.posOrder.findFirst({
      where: { id: quoteId, companyId, orderType: 'QUOTE', status: 'DRAFT' },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!quote) throw new AppError(404, 'Quotation not found');
    if (quote.convertedToOrderId) throw new AppError(409, 'Quotation was already converted');
    if (quote.expiresAt && quote.expiresAt.getTime() < Date.now()) throw new AppError(422, 'Quotation is expired');
    const sale = requiredOrder(await posOrderPostingService.createOrder(
      companyId,
      shiftId,
      {
        orderNumber: `SALE-${Date.now()}`,
        orderType: 'SALE',
        customerId: quote.customerId ?? undefined,
        notes: quote.notes ?? undefined,
        couponCode: undefined,
        lines: quote.lines.map((line, index) => ({
          itemId: line.itemId,
          unitId: line.unitId,
          quantity: Number(line.quantity),
          price: Number(line.price),
          discountPercent: line.discountPercent == null ? undefined : Number(line.discountPercent),
          taxPercent: Number(line.taxPercent),
          lineOrder: index + 1,
        })),
      },
      { ...pricingOptions(flags), userId }
    ));
    const claimed = await prisma.posOrder.updateMany({
      where: { id: quote.id, companyId, convertedToOrderId: null },
      data: { convertedToOrderId: sale.id },
    });
    if (claimed.count !== 1) throw new AppError(409, 'Quotation was already converted');
    return sale;
  }

  async exchange(
    ctx: PosPostingContext,
    input: {
      shiftId: string;
      originalOrderId: string;
      returnLines: Array<{ originalLineId: string; quantity: number }>;
      saleLines: CreatePosOrderInput['lines'];
      customerId?: string;
      collectMethod?: string;
      refundMethod?: string;
      safeId?: string;
      bankAccountId?: string;
    },
    flags: PricingFlags
  ) {
    const { accountId } = await requireLiability(ctx.companyId, 'exchangeClearingAccountId');
    if (!accountId) throw new AppError(422, 'Exchange clearing account is not configured');
    const group = randomUUID();
    const returned = requiredOrder(await posOrderPostingService.createReturn(ctx, {
      shiftId: input.shiftId,
      originalOrderId: input.originalOrderId,
      notes: `Exchange ${group}`,
      lines: input.returnLines,
    }));
    const sale = requiredOrder(await posOrderPostingService.createOrder(
      ctx.companyId,
      input.shiftId,
      {
        orderNumber: `EX-${Date.now()}`,
        orderType: 'SALE',
        customerId: input.customerId,
        notes: `Exchange ${group}`,
        lines: input.saleLines,
      },
      { ...pricingOptions(flags), userId: ctx.userId }
    ));
    await prisma.posOrder.updateMany({
      where: { id: { in: [returned.id, sale.id] }, companyId: ctx.companyId },
      data: { exchangeGroupId: group },
    });
    const split = exchangeSplit(Number(returned.netAmount), Number(sale.netAmount));
    const exchangeLeg = (amount: number): PosPaymentDraft | null =>
      amount > 0 ? { method: 'EXCHANGE', amount, referenceNumber: group } : null;
    const cashLeg = (method: string | undefined, amount: number): PosPaymentDraft | null =>
      amount > 0
        ? { method: method || 'CASH', amount, safeId: input.safeId, bankAccountId: input.bankAccountId }
        : null;
    const returnPayments = [exchangeLeg(split.offset), cashLeg(input.refundMethod, split.refund)].filter(
      (row): row is PosPaymentDraft => row != null
    );
    const salePayments = [exchangeLeg(split.offset), cashLeg(input.collectMethod, split.collect)].filter(
      (row): row is PosPaymentDraft => row != null
    );
    let postedReturn: Awaited<ReturnType<typeof posOrderPostingService.postOrder>>;
    try {
      postedReturn = await posOrderPostingService.postOrder(ctx, returned.id, returnPayments);
    } catch (error) {
      throw error;
    }
    try {
      const postedSale = await posOrderPostingService.postOrder(ctx, sale.id, salePayments);
      return { group, split, returnOrder: postedReturn, saleOrder: postedSale };
    } catch (error) {
      try {
        await posOrderPostingService.unpostOrder(ctx, returned.id);
      } catch {
        throw new AppError(500, `Exchange sale failed and return ${returned.orderNumber} stayed posted`);
      }
      throw error;
    }
  }

  async saveCoupon(
    companyId: string,
    input: {
      code: string;
      kind: 'PERCENT' | 'AMOUNT';
      percent?: number | null;
      amount?: number | null;
      minSpend?: number;
      maxUses?: number | null;
      singleUsePerCustomer?: boolean;
      customerId?: string | null;
      validFrom: string;
      validTo: string;
    }
  ) {
    const code = input.code.trim().toUpperCase();
    if (!code) throw new AppError(422, 'Coupon code is required');
    const validFrom = new Date(input.validFrom);
    const validTo = new Date(input.validTo);
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validTo.getTime()) || validTo <= validFrom) {
      throw new AppError(422, 'Coupon validity is not a real range');
    }
    return prisma.posCoupon.upsert({
      where: { companyId_code: { companyId, code } },
      create: {
        companyId,
        code,
        kind: input.kind,
        percent: input.percent == null ? null : new Decimal(input.percent),
        amount: input.amount == null ? null : new Decimal(input.amount),
        minSpend: new Decimal(input.minSpend ?? 0),
        maxUses: input.maxUses ?? null,
        singleUsePerCustomer: Boolean(input.singleUsePerCustomer),
        customerId: input.customerId ?? null,
        validFrom,
        validTo,
      },
      update: {
        kind: input.kind,
        percent: input.percent == null ? null : new Decimal(input.percent),
        amount: input.amount == null ? null : new Decimal(input.amount),
        minSpend: new Decimal(input.minSpend ?? 0),
        maxUses: input.maxUses ?? null,
        singleUsePerCustomer: Boolean(input.singleUsePerCustomer),
        customerId: input.customerId ?? null,
        validFrom,
        validTo,
        isActive: true,
      },
    });
  }

  listCoupons(companyId: string) {
    return prisma.posCoupon.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async issueGiftCard(ctx: PosPostingContext, input: { amount: number; code?: string; expiresAt?: string; safeId: string; shiftId: string }) {
    const { accountId } = await requireLiability(ctx.companyId, 'giftCardAccountId');
    const amount = roundTo2(input.amount);
    if (!(amount > 0)) throw new AppError(422, 'Gift card amount must be greater than zero');
    const code = (input.code?.trim() || randomUUID().slice(0, 12)).toUpperCase();
    const existing = await prisma.posGiftCard.findFirst({ where: { companyId: ctx.companyId, code } });
    if (existing) throw new AppError(409, 'Gift card code already exists');
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const movement = await posCashMovementService.record(ctx, {
      shiftId: input.shiftId,
      type: 'CASH_IN',
      amount,
      reason: `Gift card ${code}`,
      contraAccountId: accountId,
    });
    try {
      return await prisma.$transaction(async (tx) => {
        const card = await tx.posGiftCard.create({
          data: {
            companyId: ctx.companyId,
            code,
            initialAmount: new Decimal(amount),
            balance: new Decimal(amount),
            expiresAt,
            journalEntryId: movement.journalEntryId,
          },
        });
        await tx.posGiftCardMovement.create({
          data: {
            companyId: ctx.companyId,
            giftCardId: card.id,
            kind: 'ISSUE',
            amount: new Decimal(amount),
            sourceKey: `${card.id}:ISSUE`,
            orderId: null,
          },
        });
        return card;
      });
    } catch (error) {
      await posCashMovementService.record(ctx, {
        shiftId: input.shiftId,
        type: 'CASH_OUT',
        amount,
        reason: `Gift card ${code} reversed`,
        contraAccountId: accountId,
      });
      throw error;
    }
  }

  async loadGiftCard(ctx: PosPostingContext, input: { code: string; amount: number; safeId: string; shiftId: string }) {
    const { accountId } = await requireLiability(ctx.companyId, 'giftCardAccountId');
    const amount = roundTo2(input.amount);
    if (!(amount > 0)) throw new AppError(422, 'Load amount must be greater than zero');
    const code = input.code.trim().toUpperCase();
    const card = await prisma.posGiftCard.findFirst({ where: { companyId: ctx.companyId, code } });
    if (!card || card.status !== 'ACTIVE') throw new AppError(422, 'Gift card is not active');
    if (card.expiresAt && card.expiresAt < new Date()) throw new AppError(422, 'Gift card is expired');
    const sourceKey = `LOAD:${code}:${randomUUID()}`;
    const movement = await posCashMovementService.record(ctx, {
      shiftId: input.shiftId,
      type: 'CASH_IN',
      amount,
      reason: `Gift card load ${code}`,
      contraAccountId: accountId,
    });
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.posGiftCard.update({
          where: { id: card.id },
          data: { balance: { increment: new Decimal(amount) } },
        });
        await tx.posGiftCardMovement.create({
          data: {
            companyId: ctx.companyId,
            giftCardId: card.id,
            kind: 'LOAD',
            amount: new Decimal(amount),
            sourceKey,
            orderId: null,
          },
        });
        return next;
      });
      return { card: updated, journalEntryId: movement.journalEntryId };
    } catch (error) {
      await posCashMovementService.record(ctx, {
        shiftId: input.shiftId,
        type: 'CASH_OUT',
        amount,
        reason: `Gift card load ${code} reversed`,
        contraAccountId: accountId,
      });
      throw error;
    }
  }

  async giftCardBalance(companyId: string, code: string) {
    const card = await prisma.posGiftCard.findFirst({
      where: { companyId, code: code.trim().toUpperCase() },
      select: { code: true, balance: true, expiresAt: true, status: true },
    });
    if (!card) throw new AppError(404, 'Gift card was not found');
    return { code: card.code, balance: Number(card.balance), expiresAt: card.expiresAt, status: card.status };
  }

  async wallet(companyId: string, customerId: string) {
    const rows = await prisma.posWallet.findMany({ where: { companyId, customerId } });
    return {
      customerId,
      storeCredit: Number(rows.find((row) => row.kind === 'STORE_CREDIT')?.balance ?? 0),
      points: Number(rows.find((row) => row.kind === 'POINTS')?.balance ?? 0),
    };
  }

  async availability(companyId: string, itemId: string) {
    const rows = await prisma.itemWarehouseBalance.findMany({
      where: { companyId, itemId },
      include: { warehouse: { select: { id: true, arabicName: true, branchId: true, branch: { select: { arabicName: true } } } } },
    });
    return rows.map((row) => ({
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse.arabicName,
      branchId: row.warehouse.branchId,
      branchName: row.warehouse.branch?.arabicName ?? null,
      onHand: Number(row.quantityOnHand),
      reserved: Number(row.reservedQuantity),
      available: roundTo2(Number(row.quantityOnHand) - Number(row.reservedQuantity)),
    }));
  }

  reserveElsewhere(companyId: string, input: { warehouseId: string; itemId: string; quantity: number; reason: string }) {
    return itemReservationService.create(companyId, input);
  }

  async createReservation(
    ctx: PosPostingContext,
    input: { shiftId: string; amount: number; safeId: string; customerId?: string; notes?: string; lines: CreatePosOrderInput['lines'] },
    flags: PricingFlags
  ) {
    const { accountId } = await requireLiability(ctx.companyId, 'depositAccountId');
    const amount = roundTo2(input.amount);
    if (!(amount > 0)) throw new AppError(422, 'Deposit amount must be greater than zero');
    const order = requiredOrder(await posOrderPostingService.createOrder(
      ctx.companyId,
      input.shiftId,
      {
        orderNumber: `RSV-${Date.now()}`,
        orderType: 'RESERVATION',
        customerId: input.customerId,
        notes: input.notes,
        lines: input.lines,
      },
      { ...pricingOptions(flags), userId: ctx.userId }
    ));
    const shift = await prisma.posShift.findFirst({
      where: { id: input.shiftId, companyId: ctx.companyId },
      include: { terminal: true },
    });
    if (!shift) throw new AppError(404, 'Open POS shift not found');
    const reserved = [];
    try {
      for (const line of order.lines) {
        reserved.push(
          await itemReservationService.create(ctx.companyId, {
            warehouseId: shift.terminal.warehouseId,
            itemId: line.itemId,
            quantity: Number(line.quantity),
            reason: RESERVATION_REASON(order.id),
          })
        );
      }
    } catch (error) {
      for (const row of reserved) {
        if (row) await itemReservationService.release(ctx.companyId, row.id).catch(() => undefined);
      }
      throw error;
    }
    let movement: { journalEntryId: string | null } | null = null;
    try {
      movement = await posCashMovementService.record(ctx, {
        shiftId: input.shiftId,
        type: 'CASH_IN',
        amount,
        reason: `Deposit ${order.orderNumber}`,
        contraAccountId: accountId,
      });
      await prisma.posOrder.update({
        where: { id: order.id },
        data: { depositBalance: new Decimal(amount), depositJournalId: movement.journalEntryId },
      });
      return { orderId: order.id, orderNumber: order.orderNumber, deposit: amount, journalEntryId: movement.journalEntryId };
    } catch (error) {
      if (movement) {
        await posCashMovementService.record(ctx, {
          shiftId: input.shiftId,
          type: 'CASH_OUT',
          amount,
          reason: `Deposit ${order.orderNumber} reversed`,
          contraAccountId: accountId,
        }).catch(() => undefined);
      }
      for (const row of reserved) {
        await itemReservationService.release(ctx.companyId, row.id).catch(() => undefined);
      }
      throw error;
    }
  }

  async cancelReservation(ctx: PosPostingContext, orderId: string) {
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId, orderType: 'RESERVATION' },
    });
    if (!order) throw new AppError(404, 'Reservation not found');
    if (order.status === 'VOIDED') return order;
    const used = await prisma.posPayment.count({
      where: { companyId: ctx.companyId, method: 'DEPOSIT', referenceNumber: order.id },
    });
    if (used > 0) throw new AppError(422, 'Deposit was already applied to a sale');
    const holds = await prisma.itemReservation.findMany({
      where: { companyId: ctx.companyId, reason: RESERVATION_REASON(order.id), status: 'ACTIVE' },
    });
    const refund = roundTo2(Number(order.depositBalance));
    if (refund > 0) {
      const { accountId } = await requireLiability(ctx.companyId, 'depositAccountId');
      if (!order.shiftId) throw new AppError(422, 'Reservation has no shift for the cash refund');
      await posCashMovementService.record(ctx, {
        shiftId: order.shiftId,
        type: 'CASH_OUT',
        amount: refund,
        reason: `Deposit refund ${order.orderNumber}`,
        contraAccountId: accountId,
      });
    }
    await prisma.posOrder.update({
      where: { id: order.id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidedBy: ctx.userId,
        voidReason: 'Deposit cancelled and refunded',
        depositBalance: new Decimal(0),
      },
    });
    for (const hold of holds) {
      await itemReservationService.release(ctx.companyId, hold.id);
    }
    return prisma.posOrder.findFirst({ where: { id: order.id, companyId: ctx.companyId } });
  }

  async noSale(ctx: PosPostingContext, input: { terminalId: string; shiftId?: string; reason: string }) {
    const reason = input.reason.trim();
    if (!reason) throw new AppError(422, 'No-sale reason is required');
    const terminal = await prisma.posTerminal.findFirst({ where: { id: input.terminalId, companyId: ctx.companyId } });
    if (!terminal) throw new AppError(404, 'Terminal not found');
    const event = await prisma.posCashierEvent.create({
      data: {
        companyId: ctx.companyId,
        terminalId: terminal.id,
        shiftId: input.shiftId ?? null,
        kind: 'NO_SALE',
        userId: ctx.userId,
        reason,
      },
    });
    return event;
  }

  async setLock(ctx: PosPostingContext, terminalId: string, locked: boolean, reason: string) {
    const terminal = await prisma.posTerminal.findFirst({ where: { id: terminalId, companyId: ctx.companyId } });
    if (!terminal) throw new AppError(404, 'Terminal not found');
    const updated = await prisma.posTerminal.update({
      where: { id: terminal.id },
      data: locked ? { lockedAt: new Date(), lockedBy: ctx.userId } : { lockedAt: null, lockedBy: null },
    });
    await prisma.posCashierEvent.create({
      data: {
        companyId: ctx.companyId,
        terminalId,
        kind: locked ? 'LOCK' : 'UNLOCK',
        userId: ctx.userId,
        reason: reason.trim() || (locked ? 'Terminal locked' : 'Terminal unlocked'),
      },
    });
    return { id: updated.id, lockedAt: updated.lockedAt };
  }

  async handover(ctx: PosPostingContext, input: { shiftId: string; toUserId: string; reason: string }) {
    const shift = await prisma.posShift.findFirst({
      where: { id: input.shiftId, companyId: ctx.companyId, status: 'OPEN' },
    });
    if (!shift) throw new AppError(404, 'Open shift not found');
    const updated = await prisma.posShift.update({
      where: { id: shift.id },
      data: { currentUserId: input.toUserId },
    });
    await prisma.posCashierEvent.create({
      data: {
        companyId: ctx.companyId,
        terminalId: shift.terminalId,
        shiftId: shift.id,
        kind: 'HANDOVER',
        userId: ctx.userId,
        reason: input.reason.trim() || 'Cashier handover',
        metadata: { fromUserId: shift.currentUserId ?? shift.userId, toUserId: input.toUserId },
      },
    });
    return { shiftId: updated.id, currentUserId: updated.currentUserId, openedBy: updated.userId };
  }

  async ensureReceiptToken(companyId: string, orderId: string) {
    const order = await prisma.posOrder.findFirst({
      where: { id: orderId, companyId, status: { in: ['POSTED', 'VOIDED'] } },
      select: { id: true, receiptToken: true },
    });
    if (!order) throw new AppError(404, 'Posted POS order not found');
    if (order.receiptToken) return order.receiptToken;
    const token = randomUUID().replace(/-/g, '');
    await prisma.posOrder.update({ where: { id: order.id }, data: { receiptToken: token } });
    return token;
  }

  async deliverReceipt(
    companyId: string,
    orderId: string,
    input: { channel: 'EMAIL' | 'WHATSAPP' | 'SMS'; to?: string; templateName?: string; language?: string }
  ) {
    const token = await this.ensureReceiptToken(companyId, orderId);
    const receipt = await posOrderPostingService.receipt(companyId, orderId);
    const url = `/api/v1/public/pos/receipts/${token}`;
    if (input.channel === 'SMS') throw new AppError(422, 'SMS is not configured');
    if (input.channel === 'EMAIL') {
      if (!emailService.isEmailConfigured()) throw new AppError(422, 'Email is not configured');
      if (!input.to) throw new AppError(422, 'Email recipient is required');
      await emailService.sendEmail({
        to: input.to,
        subject: `إيصال ${receipt.orderNumber}`,
        text: `${receipt.title}\n${receipt.orderNumber}\n${receipt.net}\n${url}`,
      });
      return { channel: 'EMAIL', url };
    }
    const ready = await isCompanyWhatsappReady(companyId);
    if (!ready) throw new AppError(422, 'WhatsApp is not connected for this company');
    if (!input.to || !input.templateName) throw new AppError(422, 'WhatsApp needs a recipient and an approved template');
    await sendCompanyTemplate({
      companyId,
      to: input.to,
      templateName: input.templateName,
      language: input.language || 'ar',
      bodyParameters: [receipt.orderNumber, String(receipt.net)],
    });
    return { channel: 'WHATSAPP', url };
  }

  async receiptByToken(token: string) {
    const order = await prisma.posOrder.findFirst({
      where: { receiptToken: token },
      select: { id: true, companyId: true },
    });
    if (!order) throw new AppError(404, 'Receipt not found');
    return posOrderPostingService.receipt(order.companyId, order.id);
  }

  async explainOffer(companyId: string, itemId: string, quantity: number, customerId?: string) {
    const applied = await itemOfferService.getApplicableOffers(companyId, itemId, quantity, 'sales', undefined, undefined, undefined, undefined, customerId);
    const appliedIds = new Set(applied.map((row) => row.id));
    const candidates = await prisma.itemOffer.findMany({
      where: { companyId, type: 'sales', OR: [{ fromItemId: itemId }, { fromItemId: null, how: 'invoice-value' }] },
      orderBy: { quantity: 'desc' },
    });
    const now = new Date();
    return {
      engine:
        'العروض الحالية تُطبَّق من محرك عروض الأصناف. لا يوجد علم أولوية أو تجميع منفصل. الكمية الأكبر تُعرض أولاً، وخصم السطر اليدوي يمنع هدية العرض.',
      applied: applied.map((row) => ({
        id: row.id,
        nameAr: row.nameAr,
        how: row.how,
        quantity: Number(row.quantity),
        percentage: row.percentage == null ? null : Number(row.percentage),
        reason: 'مطابق للتاريخ والكمية والطرف',
      })),
      skipped: candidates
        .filter((row) => !appliedIds.has(row.id))
        .map((row) => {
          let reason = 'لا يطابق شروط التطبيق';
          if (!row.isActive) reason = 'العرض غير نشط';
          else if (now < row.fromDate || now > row.toDate) reason = 'خارج فترة العرض';
          else if (Number(row.quantity) > quantity && row.how !== 'invoice-value') reason = 'الكمية أقل من شرط العرض';
          return {
            id: row.id,
            nameAr: row.nameAr,
            how: row.how,
            quantity: Number(row.quantity),
            fromDate: row.fromDate,
            toDate: row.toDate,
            isActive: row.isActive,
            reason,
          };
        }),
    };
  }
}

export const posCommercialService = new PosCommercialService();
