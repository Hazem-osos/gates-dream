import prisma from '../../../shared/database/prisma';
import { roundTo2 } from '../utils/pos-money';

function cairoHour(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Africa/Cairo',
  }).format(date);
}

export async function posRetailReport(
  companyId: string,
  filters: { from: Date; to: Date; branchId?: string; terminalId?: string; shiftId?: string }
) {
  const orders = await prisma.posOrder.findMany({
    where: {
      companyId,
      status: 'POSTED',
      postedAt: { gte: filters.from, lte: filters.to },
      ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
      shift: {
        ...(filters.terminalId ? { terminalId: filters.terminalId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
    },
    include: {
      lines: { include: { item: { select: { arabicName: true, category: { select: { id: true, arabicName: true } } } } } },
      payments: true,
      customer: { select: { id: true, arabicName: true } },
      shift: {
        select: {
          id: true,
          userId: true,
          terminalId: true,
          branchId: true,
          terminal: { select: { name: true, branch: { select: { id: true, arabicName: true } } } },
        },
      },
    },
  });

  const cashiers = new Map<string, { cashierId: string; net: number; orders: number }>();
  const items = new Map<string, { itemId: string; name: string; quantity: number; net: number }>();
  const categories = new Map<string, { categoryId: string | null; name: string; net: number; quantity: number }>();
  const payments = new Map<string, { method: string; label: string; amount: number }>();
  const sessions = new Map<string, { shiftId: string; terminalName: string; cashierId: string | null; net: number; orders: number; returns: number }>();
  const hours = new Map<string, { hour: string; net: number; orders: number }>();
  const customers = new Map<string, { customerId: string | null; name: string; net: number; orders: number }>();
  const terminals = new Map<string, { terminalId: string; name: string; net: number; orders: number }>();
  const branches = new Map<string, { branchId: string; name: string; net: number; orders: number }>();
  const returnReasons = new Map<string, { reason: string; count: number; net: number }>();
  const capture = new Map<string, { status: string; amount: number; count: number }>();
  let returnNet = 0;
  let returnCount = 0;
  let gross = 0;
  let netSales = 0;
  let tax = 0;
  let discount = 0;
  let cogs = 0;
  let giftQuantity = 0;
  let giftLines = 0;
  let creditSales = 0;

  for (const order of orders) {
    const net = Number(order.netAmount);
    const sign = order.orderType === 'RETURN' ? -1 : 1;
    gross = roundTo2(gross + sign * Number(order.totalAmount));
    netSales = roundTo2(netSales + sign * net);
    tax = roundTo2(tax + sign * Number(order.taxAmount));
    discount = roundTo2(discount + sign * Number(order.discountAmount));
    cogs = roundTo2(cogs + sign * order.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitCost), 0));
    const cashierId = order.postedBy ?? order.shift.userId;
    const cashier = cashiers.get(cashierId) ?? { cashierId, net: 0, orders: 0 };
    cashier.net = roundTo2(cashier.net + sign * net);
    cashier.orders += 1;
    cashiers.set(cashierId, cashier);

    const hourKey = order.postedAt ? cairoHour(order.postedAt) : '00';
    const hour = hours.get(hourKey) ?? { hour: hourKey, net: 0, orders: 0 };
    hour.net = roundTo2(hour.net + sign * net);
    hour.orders += 1;
    hours.set(hourKey, hour);

    const customerKey = order.customerId ?? 'none';
    const customer = customers.get(customerKey) ?? {
      customerId: order.customerId,
      name: order.customer?.arabicName ?? 'بدون عميل',
      net: 0,
      orders: 0,
    };
    customer.net = roundTo2(customer.net + sign * net);
    customer.orders += 1;
    customers.set(customerKey, customer);

    const terminal = terminals.get(order.shift.terminalId) ?? {
      terminalId: order.shift.terminalId,
      name: order.shift.terminal.name,
      net: 0,
      orders: 0,
    };
    terminal.net = roundTo2(terminal.net + sign * net);
    terminal.orders += 1;
    terminals.set(order.shift.terminalId, terminal);

    const branchId = order.shift.branchId;
    const branch = branches.get(branchId) ?? {
      branchId,
      name: order.shift.terminal.branch.arabicName,
      net: 0,
      orders: 0,
    };
    branch.net = roundTo2(branch.net + sign * net);
    branch.orders += 1;
    branches.set(branchId, branch);

    const session = sessions.get(order.shiftId) ?? {
      shiftId: order.shiftId,
      terminalName: order.shift.terminal.name,
      cashierId: order.shift.userId,
      net: 0,
      orders: 0,
      returns: 0,
    };
    session.net = roundTo2(session.net + sign * net);
    if (order.orderType === 'RETURN') {
      session.returns += 1;
      returnNet = roundTo2(returnNet + net);
      returnCount += 1;
      const reason = order.notes?.trim() || 'بدون سبب';
      const bucket = returnReasons.get(reason) ?? { reason, count: 0, net: 0 };
      bucket.count += 1;
      bucket.net = roundTo2(bucket.net + net);
      returnReasons.set(reason, bucket);
    } else {
      session.orders += 1;
    }
    sessions.set(order.shiftId, session);

    for (const line of order.lines) {
      const qty = Number(line.quantity) * sign;
      const lineNet = Number(line.lineTotal) * sign;
      const item = items.get(line.itemId) ?? { itemId: line.itemId, name: line.item.arabicName, quantity: 0, net: 0 };
      item.quantity = roundTo2(item.quantity + qty);
      item.net = roundTo2(item.net + lineNet);
      items.set(line.itemId, item);
      const categoryId = line.item.category?.id ?? null;
      const categoryName = line.item.category?.arabicName ?? 'بدون تصنيف';
      const key = categoryId ?? 'none';
      const category = categories.get(key) ?? { categoryId, name: categoryName, net: 0, quantity: 0 };
      category.net = roundTo2(category.net + lineNet);
      category.quantity = roundTo2(category.quantity + qty);
      categories.set(key, category);
      if (line.isGift) {
        giftLines += 1;
        giftQuantity = roundTo2(giftQuantity + Number(line.quantity));
      }
    }
    for (const payment of order.payments) {
      const key = payment.method;
      const row = payments.get(key) ?? { method: payment.method, label: payment.methodLabel || payment.method, amount: 0 };
      row.amount = roundTo2(row.amount + sign * Number(payment.amount));
      payments.set(key, row);
      if (payment.settlementType === 'CREDIT') creditSales = roundTo2(creditSales + sign * Number(payment.amount));
      const captureKey = payment.captureStatus || 'MANUAL';
      const captureRow = capture.get(captureKey) ?? { status: captureKey, amount: 0, count: 0 };
      captureRow.amount = roundTo2(captureRow.amount + sign * Number(payment.amount));
      captureRow.count += 1;
      capture.set(captureKey, captureRow);
    }
  }

  const scope = {
    ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
    shift: {
      ...(filters.terminalId ? { terminalId: filters.terminalId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
  };
  const [closes, voids, movements, collections] = await Promise.all([
    prisma.posShiftClose.findMany({
      where: {
        companyId,
        closedAt: { gte: filters.from, lte: filters.to },
        ...(filters.terminalId ? { terminalId: filters.terminalId } : {}),
        ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
      },
      orderBy: { closedAt: 'desc' },
    }),
    prisma.posOrder.findMany({
      where: {
        companyId,
        status: 'VOIDED',
        voidedAt: { gte: filters.from, lte: filters.to },
        ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
      },
      select: { id: true, orderNumber: true, voidReason: true, netAmount: true },
    }),
    prisma.posCashMovement.findMany({
      where: { companyId, createdAt: { gte: filters.from, lte: filters.to }, ...scope },
      select: { id: true, type: true, amount: true, reason: true, createdAt: true, shiftId: true },
    }),
    prisma.posCreditCollection.findMany({
      where: {
        companyId,
        createdAt: { gte: filters.from, lte: filters.to },
        ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
      },
      select: { id: true, customerId: true, amount: true, clientRequestId: true, createdAt: true },
    }),
  ]);

  const grossProfit = roundTo2(netSales - tax - cogs);
  const merchandise = roundTo2(netSales - tax);
  return {
    source: 'POS_ORDER' as const,
    byCashier: [...cashiers.values()],
    byItem: [...items.values()],
    byCategory: [...categories.values()],
    byPaymentMethod: [...payments.values()],
    byHour: [...hours.values()].sort((a, b) => a.hour.localeCompare(b.hour)),
    byCustomer: [...customers.values()],
    byTerminal: [...terminals.values()],
    byBranch: [...branches.values()],
    returns: { count: returnCount, net: returnNet },
    returnReasons: [...returnReasons.values()],
    gifts: { lines: giftLines, quantity: giftQuantity },
    creditSales,
    collections: collections.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      amount: Number(row.amount),
      reference: row.clientRequestId,
      createdAt: row.createdAt,
    })),
    cashMovements: movements.map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      reason: row.reason,
      shiftId: row.shiftId,
      createdAt: row.createdAt,
    })),
    paymentReconciliation: [...capture.values()],
    totals: {
      gross,
      net: netSales,
      tax,
      discount,
      cogs,
      grossProfit,
      margin: merchandise === 0 ? null : roundTo2((grossProfit / merchandise) * 100),
    },
    voids: voids.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      reason: row.voidReason,
      net: Number(row.netAmount),
    })),
    bySession: [...sessions.values()],
    closes: closes.map((row) => ({
      shiftId: row.shiftId,
      terminalName: row.terminalName,
      cashierId: row.cashierId,
      expectedCash: Number(row.expectedCash),
      countedCash: Number(row.countedCash),
      variance: Number(row.variance),
      netSales: Number(row.netSales),
    })),
    varianceTotal: roundTo2(closes.reduce((sum, row) => sum + Number(row.variance), 0)),
    settlementNote: 'Drawer cash uses CASH settlement. Payment rows keep their posted method code.',
  };
}
