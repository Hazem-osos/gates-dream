import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo2 } from '../utils/pos-money';
import { couponDiscount, type CouponRule } from './pos-commercial-math';
import type { PreparedPosPayment } from './pos-payment.service';

type Tx = Prisma.TransactionClient;

function ruleOf(row: {
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
  minSpend: Decimal;
  kind: string;
  percent: Decimal | null;
  amount: Decimal | null;
  maxUses: number | null;
  usedCount: number;
  customerId: string | null;
  singleUsePerCustomer: boolean;
}): CouponRule {
  return {
    isActive: row.isActive,
    validFrom: row.validFrom,
    validTo: row.validTo,
    minSpend: Number(row.minSpend),
    kind: row.kind === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
    percent: row.percent == null ? null : Number(row.percent),
    amount: row.amount == null ? null : Number(row.amount),
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    customerId: row.customerId,
    singleUsePerCustomer: row.singleUsePerCustomer,
  };
}

export async function previewCoupon(companyId: string, code: string, customerId: string | null, merchandise: number) {
  const coupon = await prisma.posCoupon.findFirst({
    where: { companyId, code: code.trim().toUpperCase() },
  });
  if (!coupon) throw new AppError(422, 'Coupon was not found');
  const prior = customerId
    ? await prisma.posCouponRedemption.count({ where: { couponId: coupon.id, customerId } })
    : 0;
  const decision = couponDiscount(ruleOf(coupon), merchandise, customerId, prior > 0);
  if (!decision.ok) throw new AppError(422, decision.reason);
  return { couponId: coupon.id, discount: decision.discount };
}

export async function consumeCoupon(
  tx: Tx,
  companyId: string,
  orderId: string,
  couponId: string,
  customerId: string | null,
  amount: number
) {
  const existing = await tx.posCouponRedemption.findFirst({ where: { couponId, orderId } });
  if (existing) return;
  const coupon = await tx.posCoupon.findFirst({ where: { id: couponId, companyId } });
  if (!coupon) throw new AppError(422, 'Coupon was not found');
  if (!coupon.isActive || new Date() < coupon.validFrom || new Date() > coupon.validTo) {
    throw new AppError(422, 'Coupon is not valid');
  }
  if (coupon.singleUsePerCustomer && customerId) {
    const prior = await tx.posCouponRedemption.count({ where: { couponId, customerId } });
    if (prior > 0) throw new AppError(422, 'Coupon was already used by this customer');
  }
  const claimed = await tx.posCoupon.updateMany({
    where: {
      id: couponId,
      companyId,
      isActive: true,
      OR: [{ maxUses: null }, { usedCount: { lt: coupon.maxUses ?? 0 } }],
    },
    data: { usedCount: { increment: 1 } },
  });
  if (claimed.count !== 1) throw new AppError(409, 'Coupon has no uses left');
  await tx.posCouponRedemption.create({
    data: {
      companyId,
      couponId,
      orderId,
      customerId,
      amount: new Decimal(roundTo2(amount)),
    },
  });
}

async function moveWallet(
  tx: Tx,
  companyId: string,
  customerId: string,
  kind: 'STORE_CREDIT' | 'POINTS',
  delta: number,
  sourceKey: string,
  orderId: string
) {
  const existing = await tx.posWalletMovement.findFirst({ where: { companyId, sourceKey } });
  if (existing) return;
  let wallet = await tx.posWallet.findFirst({ where: { companyId, customerId, kind } });
  if (!wallet) {
    wallet = await tx.posWallet.create({
      data: { companyId, customerId, kind, balance: new Decimal(0) },
    });
  }
  if (delta < 0) {
    const taken = await tx.posWallet.updateMany({
      where: { id: wallet.id, balance: { gte: new Decimal(roundTo2(-delta)) } },
      data: { balance: { decrement: new Decimal(roundTo2(-delta)) } },
    });
    if (taken.count !== 1) throw new AppError(422, 'Customer wallet balance is not enough');
  } else {
    await tx.posWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: new Decimal(roundTo2(delta)) } },
    });
  }
  await tx.posWalletMovement.create({
    data: {
      companyId,
      walletId: wallet.id,
      kind,
      amount: new Decimal(roundTo2(Math.abs(delta))),
      sourceKey,
      orderId,
    },
  });
}

export async function consumeCommercialTenders(
  tx: Tx,
  args: {
    companyId: string;
    orderId: string;
    orderType: string;
    customerId: string | null;
    payments: PreparedPosPayment[];
  }
) {
  const sign = args.orderType === 'RETURN' ? -1 : 1;
  for (const payment of args.payments) {
    if (payment.method === 'GIFT_CARD') {
      const code = payment.referenceNumber?.trim().toUpperCase() ?? '';
      const sourceKey = `${args.orderId}:GIFT:${code}`;
      const seen = await tx.posGiftCardMovement.findFirst({ where: { companyId: args.companyId, sourceKey } });
      if (seen) continue;
      const cards = await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal; expiresAt: Date | null; status: string }>>`
        SELECT id, balance, expiresAt, status FROM pos_gift_cards
        WHERE companyId = ${args.companyId} AND code = ${code}
        FOR UPDATE
      `;
      const card = cards[0];
      if (!card || card.status !== 'ACTIVE') throw new AppError(422, 'Gift card is not active');
      if (card.expiresAt && card.expiresAt < new Date()) throw new AppError(422, 'Gift card is expired');
      if (sign > 0) {
        const taken = await tx.posGiftCard.updateMany({
          where: { id: card.id, balance: { gte: new Decimal(payment.amount) }, status: 'ACTIVE' },
          data: { balance: { decrement: new Decimal(payment.amount) } },
        });
        if (taken.count !== 1) throw new AppError(422, 'Gift card balance is not enough');
      } else {
        await tx.posGiftCard.update({
          where: { id: card.id },
          data: { balance: { increment: new Decimal(payment.amount) } },
        });
      }
      await tx.posGiftCardMovement.create({
        data: {
          companyId: args.companyId,
          giftCardId: card.id,
          kind: sign > 0 ? 'REDEEM' : 'REFUND',
          amount: new Decimal(payment.amount),
          sourceKey,
          orderId: args.orderId,
        },
      });
    }
    if (payment.method === 'STORE_CREDIT' || payment.method === 'POINTS') {
      if (!args.customerId) throw new AppError(422, 'This tender needs a customer');
      const delta = sign > 0 ? -payment.amount : payment.amount;
      await moveWallet(
        tx,
        args.companyId,
        args.customerId,
        payment.method,
        delta,
        `${args.orderId}:${payment.method}`,
        args.orderId
      );
    }
    if (payment.method === 'DEPOSIT') {
      const reservationId = payment.referenceNumber?.trim() ?? '';
      const reservation = await tx.posOrder.findFirst({
        where: { id: reservationId, companyId: args.companyId, orderType: 'RESERVATION' },
      });
      if (!reservation) throw new AppError(422, 'Deposit reservation was not found');
      if (sign > 0) {
        const taken = await tx.posOrder.updateMany({
          where: { id: reservation.id, depositBalance: { gte: new Decimal(payment.amount) } },
          data: { depositBalance: { decrement: new Decimal(payment.amount) } },
        });
        if (taken.count !== 1) throw new AppError(422, 'Deposit balance is not enough');
      }
    }
  }
}

export async function earnSalePoints(
  tx: Tx,
  companyId: string,
  orderId: string,
  customerId: string | null,
  netAmount: number,
  pointsPerAmount: number | null
) {
  if (!customerId || !pointsPerAmount || pointsPerAmount <= 0 || !(netAmount > 0)) return;
  const points = roundTo2(netAmount * pointsPerAmount);
  if (!(points > 0)) return;
  await moveWallet(tx, companyId, customerId, 'POINTS', points, `${orderId}:EARN`, orderId);
}
