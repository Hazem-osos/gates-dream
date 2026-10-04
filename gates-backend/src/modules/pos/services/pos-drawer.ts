import type { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo2 } from '../utils/pos-money';

export type DrawerEquation = {
  openingCash: number;
  grossSales: number;
  netSales: number;
  returnsNet: number;
  cashSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  orderCount: number;
  returnCount: number;
  paymentBreakdown: Record<string, { sales: number; refunds: number }>;
};

export function expectedDrawerCash(parts: {
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
}): number {
  return roundTo2(
    parts.openingCash + parts.cashSales - parts.cashRefunds + parts.cashIn - parts.cashOut
  );
}

type Tx = Prisma.TransactionClient;

/** Serialize operational writes on one session. Caller must already be inside a transaction. */
export async function lockShiftRow(tx: Tx, companyId: string, shiftId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM pos_shifts WHERE id = ${shiftId} AND companyId = ${companyId} FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function loadDrawerEquation(
  tx: Tx,
  companyId: string,
  shiftId: string,
  openingCash: number
): Promise<DrawerEquation> {
  const orders = await tx.posOrder.findMany({
    where: { companyId, shiftId, status: 'POSTED' },
    include: { payments: true },
  });
  const movements = await tx.posCashMovement.findMany({
    where: { companyId, shiftId },
  });

  const breakdown: Record<string, { sales: number; refunds: number }> = {};
  const add = (method: string, kind: 'sales' | 'refunds', amount: number) => {
    const row = breakdown[method] ?? { sales: 0, refunds: 0 };
    row[kind] = roundTo2(row[kind] + amount);
    breakdown[method] = row;
  };

  let grossSales = 0;
  let salesNet = 0;
  let returnsNet = 0;
  let orderCount = 0;
  let returnCount = 0;
  for (const order of orders) {
    const net = Number(order.netAmount);
    const isReturn = order.orderType === 'RETURN';
    if (isReturn) {
      returnsNet = roundTo2(returnsNet + net);
      returnCount += 1;
    } else {
      grossSales = roundTo2(grossSales + Number(order.totalAmount));
      salesNet = roundTo2(salesNet + net);
      orderCount += 1;
    }
    if (order.payments.length) {
      for (const payment of order.payments) {
        const amount = Number(payment.amount);
        const kind = isReturn ? 'refunds' : 'sales';
        const isCash =
          payment.settlementType === 'CASH' ||
          (!payment.settlementType && payment.method === 'CASH');
        if (isCash && payment.method !== 'CASH') add('CASH', kind, amount);
        add(payment.method, kind, amount);
      }
    } else {
      add('CASH', isReturn ? 'refunds' : 'sales', Number(order.cashAmount));
      add('CARD', isReturn ? 'refunds' : 'sales', Number(order.cardAmount));
      add('CREDIT', isReturn ? 'refunds' : 'sales', Number(order.creditAmount));
    }
  }

  let cashIn = 0;
  let cashOut = 0;
  for (const movement of movements) {
    const amount = Number(movement.amount);
    if (movement.type === 'CASH_IN') cashIn = roundTo2(cashIn + amount);
    if (movement.type === 'CASH_OUT') cashOut = roundTo2(cashOut + amount);
  }

  const cashSales = breakdown.CASH?.sales ?? 0;
  const cashRefunds = breakdown.CASH?.refunds ?? 0;
  const opening = roundTo2(openingCash);
  return {
    openingCash: opening,
    grossSales,
    netSales: roundTo2(salesNet - returnsNet),
    returnsNet,
    cashSales,
    cashRefunds,
    cashIn,
    cashOut,
    expectedCash: expectedDrawerCash({
      openingCash: opening,
      cashSales,
      cashRefunds,
      cashIn,
      cashOut,
    }),
    orderCount,
    returnCount,
    paymentBreakdown: breakdown,
  };
}

export function assertShiftOpen(status: string | undefined) {
  if (status !== 'OPEN') throw new AppError(400, 'Shift is not open');
}
