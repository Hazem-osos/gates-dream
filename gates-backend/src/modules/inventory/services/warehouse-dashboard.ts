import { roundTo4 } from '../../../shared/utils/decimal-round';
import { matchesOrderLimitStatus, resolveEffectiveOrderLimit } from './order-limit-status';
import { daysUntilExpiry } from './expiry-date-report';

export type BalanceRow = {
  itemId: string;
  warehouseId: string;
  quantity: number;
  lastAt: Date | null;
};

export type ItemFact = {
  id: string;
  serial: string;
  arabicName: string;
  averageCost: number;
  orderLimit: number;
};

export type WarehouseFact = {
  id: string;
  arabicName: string;
};

export type FlowRow = {
  warehouseId: string;
  day: string;
  inbound: number;
  outbound: number;
};

export type TopMove = { itemId: string; movement: number };

export type ExpiryHit = {
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  daysLeft: number;
  quantity: number;
  expiryDate: string;
};

export type OpenTransfer = {
  id: string;
  serial: string;
  date: string;
  fromName: string;
  toName: string;
};

export type PulseAlert = {
  itemId: string;
  itemName: string;
  serial: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  orderLimit?: number;
};

const STACK_LIMIT = 6;
const LIST_LIMIT = 8;

function dayKeys(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return days;
  while (cursor.getTime() <= end.getTime() && days.length < 40) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function assembleWarehousePulse(input: {
  today: string;
  monthStart: string;
  balances: BalanceRow[];
  items: ItemFact[];
  warehouses: WarehouseFact[];
  limitOverrides: Array<{ warehouseId: string; itemId: string; orderLimit: number }>;
  flows: FlowRow[];
  topMoves: TopMove[];
  expiry: ExpiryHit[];
  transfers: OpenTransfer[];
  unpostedTransferCount: number;
}) {
  const itemById = new Map(input.items.map((row) => [row.id, row]));
  const warehouseById = new Map(input.warehouses.map((row) => [row.id, row]));
  const limitByKey = new Map(
    input.limitOverrides.map((row) => [`${row.warehouseId}:${row.itemId}`, row.orderLimit])
  );
  const nameOf = (id: string) => warehouseById.get(id)?.arabicName || 'مخزن';

  let quantityOnHand = 0;
  let stockValue = 0;
  const valueByWarehouse = new Map<string, { quantity: number; stockValue: number }>();
  const below: PulseAlert[] = [];
  const negative: PulseAlert[] = [];

  for (const row of input.balances) {
    const item = itemById.get(row.itemId);
    if (!item) continue;
    const quantity = roundTo4(row.quantity);
    const value = roundTo4(quantity * item.averageCost);
    quantityOnHand = roundTo4(quantityOnHand + quantity);
    stockValue = roundTo4(stockValue + value);
    const bucket = valueByWarehouse.get(row.warehouseId) ?? { quantity: 0, stockValue: 0 };
    bucket.quantity = roundTo4(bucket.quantity + quantity);
    bucket.stockValue = roundTo4(bucket.stockValue + value);
    valueByWarehouse.set(row.warehouseId, bucket);

    const orderLimit = resolveEffectiveOrderLimit(
      limitByKey.get(`${row.warehouseId}:${row.itemId}`),
      item.orderLimit
    );
    if (matchesOrderLimitStatus(orderLimit, quantity, 'exceeded')) {
      below.push({
        itemId: row.itemId,
        itemName: item.arabicName,
        serial: item.serial,
        warehouseId: row.warehouseId,
        warehouseName: nameOf(row.warehouseId),
        quantity,
        orderLimit,
      });
    }
    if (quantity < 0) {
      negative.push({
        itemId: row.itemId,
        itemName: item.arabicName,
        serial: item.serial,
        warehouseId: row.warehouseId,
        warehouseName: nameOf(row.warehouseId),
        quantity,
      });
    }
  }

  const soon = input.expiry.filter((row) => row.quantity > 0 && row.daysLeft >= 0 && row.daysLeft <= 30);

  let inboundToday = 0;
  let outboundToday = 0;
  const inboundByWarehouse = new Map<string, number>();
  const flowByDay = new Map<string, Map<string, { inbound: number; outbound: number }>>();
  for (const row of input.flows) {
    if (row.day === input.today) {
      inboundToday = roundTo4(inboundToday + row.inbound);
      outboundToday = roundTo4(outboundToday + row.outbound);
    }
    inboundByWarehouse.set(row.warehouseId, roundTo4((inboundByWarehouse.get(row.warehouseId) ?? 0) + row.inbound));
    const day = flowByDay.get(row.day) ?? new Map();
    const cell = day.get(row.warehouseId) ?? { inbound: 0, outbound: 0 };
    cell.inbound = roundTo4(cell.inbound + row.inbound);
    cell.outbound = roundTo4(cell.outbound + row.outbound);
    day.set(row.warehouseId, cell);
    flowByDay.set(row.day, day);
  }

  const stackIds = [...inboundByWarehouse.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, STACK_LIMIT)
    .map(([id]) => id);
  const stackSet = new Set(stackIds);

  const days = dayKeys(input.monthStart, input.today).map((date) => {
    const cells = flowByDay.get(date);
    let inbound = 0;
    let outbound = 0;
    const stacks: Record<string, number> = {};
    for (const id of stackIds) stacks[id] = 0;
    let other = 0;
    if (cells) {
      for (const [warehouseId, cell] of cells) {
        inbound = roundTo4(inbound + cell.inbound);
        outbound = roundTo4(outbound + cell.outbound);
        if (stackSet.has(warehouseId)) stacks[warehouseId] = cell.inbound;
        else other = roundTo4(other + cell.inbound);
      }
    }
    if (inboundByWarehouse.size > STACK_LIMIT) stacks.other = other;
    return { date, label: String(Number(date.slice(8, 10))), inbound, outbound, stacks };
  });

  const slices = [...valueByWarehouse.entries()]
    .map(([id, row]) => ({
      id,
      name: nameOf(id),
      quantity: row.quantity,
      stockValue: row.stockValue,
    }))
    .filter((row) => row.stockValue !== 0)
    .sort((a, b) => b.stockValue - a.stockValue);

  const topItems = input.topMoves
    .map((row) => {
      const item = itemById.get(row.itemId);
      if (!item) return null;
      return {
        itemId: row.itemId,
        name: item.arabicName,
        serial: item.serial,
        movement: roundTo4(row.movement),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  below.sort((a, b) => a.quantity - b.quantity);
  negative.sort((a, b) => a.quantity - b.quantity);
  soon.sort((a, b) => a.daysLeft - b.daysLeft || a.itemName.localeCompare(b.itemName, 'ar'));

  return {
    today: input.today,
    warehouses: input.warehouses.map((row) => ({ id: row.id, name: row.arabicName })),
    totals: {
      quantityOnHand,
      stockValue,
      belowOrderLimit: below.length,
      expiringWithin30: soon.length,
      inboundToday,
      outboundToday,
    },
    days,
    stackWarehouses: [
      ...stackIds.map((id) => ({ id, name: nameOf(id) })),
      ...(inboundByWarehouse.size > STACK_LIMIT ? [{ id: 'other', name: 'مخازن أخرى' }] : []),
    ],
    slices,
    topItems,
    alerts: {
      belowOrder: below.slice(0, LIST_LIMIT),
      belowOrderCount: below.length,
      expiring: soon.slice(0, LIST_LIMIT),
      expiringCount: soon.length,
      negative: negative.slice(0, LIST_LIMIT),
      negativeCount: negative.length,
      unpostedTransfers: input.transfers.slice(0, LIST_LIMIT),
      unpostedTransferCount: input.unpostedTransferCount,
    },
  };
}

export function assembleWarehouseCompare(input: {
  balances: BalanceRow[];
  items: ItemFact[];
  warehouses: WarehouseFact[];
  flows: FlowRow[];
  expiry: ExpiryHit[];
  deadBefore: Date;
}) {
  const itemById = new Map(input.items.map((row) => [row.id, row]));
  const cards = new Map<
    string,
    {
      id: string;
      name: string;
      quantity: number;
      stockValue: number;
      inbound: number;
      outbound: number;
      deadQuantity: number;
      deadValue: number;
    }
  >();
  const ensure = (id: string, name: string) => {
    const current = cards.get(id);
    if (current) return current;
    const created = {
      id,
      name,
      quantity: 0,
      stockValue: 0,
      inbound: 0,
      outbound: 0,
      deadQuantity: 0,
      deadValue: 0,
    };
    cards.set(id, created);
    return created;
  };

  for (const warehouse of input.warehouses) ensure(warehouse.id, warehouse.arabicName);

  for (const row of input.balances) {
    const item = itemById.get(row.itemId);
    if (!item) continue;
    const card = ensure(row.warehouseId, 'مخزن');
    const quantity = roundTo4(row.quantity);
    const value = roundTo4(quantity * item.averageCost);
    card.quantity = roundTo4(card.quantity + quantity);
    card.stockValue = roundTo4(card.stockValue + value);
    if (quantity > 0 && (!row.lastAt || row.lastAt < input.deadBefore)) {
      card.deadQuantity = roundTo4(card.deadQuantity + quantity);
      card.deadValue = roundTo4(card.deadValue + value);
    }
  }

  for (const row of input.flows) {
    const card = cards.get(row.warehouseId);
    if (!card) continue;
    card.inbound = roundTo4(card.inbound + row.inbound);
    card.outbound = roundTo4(card.outbound + row.outbound);
  }

  const warehouses = [...cards.values()]
    .map((card) => ({
      ...card,
      speed: card.quantity > 0 ? roundTo4(card.outbound / card.quantity) : null,
      deadRatio: card.stockValue > 0 ? roundTo4(card.deadValue / card.stockValue) : null,
    }))
    .sort((a, b) => b.stockValue - a.stockValue || a.name.localeCompare(b.name, 'ar'));

  const live = input.expiry.filter((row) => row.quantity > 0 && row.daysLeft >= 0 && row.daysLeft <= 90);
  live.sort((a, b) => a.daysLeft - b.daysLeft || a.itemName.localeCompare(b.itemName, 'ar'));
  const band = (from: number, to: number) => live.filter((row) => row.daysLeft >= from && row.daysLeft <= to);

  return {
    warehouses,
    expiry: {
      d30: band(0, 30),
      d60: band(31, 60),
      d90: band(61, 90),
    },
  };
}

export function expiryHitsFromLots(
  lots: Array<{
    itemId: string;
    itemName: string;
    warehouseId: string;
    warehouseName: string;
    batchNumber: string;
    expiryDate: Date;
    quantity: number;
    side: 'in' | 'out';
  }>,
  today: Date
): ExpiryHit[] {
  const groups = new Map<string, { hit: ExpiryHit; remaining: number }>();
  for (const lot of lots) {
    if (Number.isNaN(lot.expiryDate.getTime())) continue;
    const day = lot.expiryDate.toISOString().slice(0, 10);
    const key = `${lot.itemId}|${lot.warehouseId}|${lot.batchNumber}|${day}`;
    const signed = lot.side === 'out' ? -Math.abs(lot.quantity) : Math.abs(lot.quantity);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        remaining: signed,
        hit: {
          itemId: lot.itemId,
          itemName: lot.itemName,
          warehouseId: lot.warehouseId,
          warehouseName: lot.warehouseName,
          daysLeft: daysUntilExpiry(lot.expiryDate, today),
          quantity: 0,
          expiryDate: lot.expiryDate.toISOString(),
        },
      });
      continue;
    }
    current.remaining = roundTo4(current.remaining + signed);
  }
  return [...groups.values()].map((group) => ({
    ...group.hit,
    quantity: roundTo4(group.remaining),
  }));
}
