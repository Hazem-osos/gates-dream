import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { businessCalendarDayKey, endOfDayUtc, startOfDayUtc } from '../../../shared/utils/report-date';
import { parseBatchAllocations } from './expiry-date-report';
import {
  assembleWarehouseCompare,
  assembleWarehousePulse,
  expiryHitsFromLots,
  type BalanceRow,
  type ExpiryHit,
  type FlowRow,
  type ItemFact,
} from './warehouse-dashboard';

function num(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function utcToday(): string {
  return businessCalendarDayKey(new Date());
}

function bucketFlows(
  rows: Array<{ warehouseId: string; documentDate: Date; quantityDelta: unknown }>
): FlowRow[] {
  const byKey = new Map<string, { inbound: number; outbound: number }>();
  for (const row of rows) {
    const day = businessCalendarDayKey(new Date(row.documentDate));
    const key = `${row.warehouseId}|${day}`;
    const cell = byKey.get(key) ?? { inbound: 0, outbound: 0 };
    const delta = num(row.quantityDelta);
    if (delta > 0) cell.inbound = roundTo4(cell.inbound + delta);
    else if (delta < 0) cell.outbound = roundTo4(cell.outbound + -delta);
    byKey.set(key, cell);
  }
  const out: FlowRow[] = [];
  for (const [key, cell] of byKey) {
    const [warehouseId, day] = key.split('|');
    out.push({ warehouseId, day, inbound: cell.inbound, outbound: cell.outbound });
  }
  return out;
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function lotSide(invoice: { invoiceKind?: string | null; invoiceType?: string | null }): 'in' | 'out' {
  const kind = invoice.invoiceKind || '';
  const type = invoice.invoiceType || '';
  if (kind === 'PURCHASE_RETURN' || type === 'purchaseReturn') return 'out';
  if (kind === 'SALE_RETURN' || type === 'salesReturn') return 'in';
  if (kind === 'SALE' || type === 'sales') return 'out';
  return 'in';
}

async function loadBalances(companyId: string, todayEnd: Date, warehouseId?: string): Promise<BalanceRow[]> {
  const warehouseSql = warehouseId ? Prisma.sql`AND warehouseId = ${warehouseId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<
    Array<{ itemId: string; warehouseId: string; qty: unknown; lastAt: Date | null }>
  >(Prisma.sql`
    SELECT itemId, warehouseId, SUM(quantityDelta) AS qty, MAX(documentDate) AS lastAt
    FROM inventory_movements
    WHERE companyId = ${companyId}
      AND documentDate <= ${todayEnd}
      ${warehouseSql}
    GROUP BY itemId, warehouseId
  `);
  return rows.map((row) => ({
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    quantity: num(row.qty),
    lastAt: row.lastAt ? new Date(row.lastAt) : null,
  }));
}

async function loadFlows(
  companyId: string,
  monthStart: Date,
  todayEnd: Date,
  warehouseId?: string
): Promise<FlowRow[]> {
  const warehouseSql = warehouseId ? Prisma.sql`AND warehouseId = ${warehouseId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<
    Array<{ warehouseId: string; documentDate: Date; quantityDelta: unknown }>
  >(Prisma.sql`
    SELECT warehouseId, documentDate, quantityDelta
    FROM inventory_movements
    WHERE companyId = ${companyId}
      AND documentDate >= ${monthStart}
      AND documentDate <= ${todayEnd}
      ${warehouseSql}
  `);
  return bucketFlows(rows);
}

async function loadTopMoves(
  companyId: string,
  monthStart: Date,
  todayEnd: Date,
  warehouseId?: string
) {
  const warehouseSql = warehouseId ? Prisma.sql`AND warehouseId = ${warehouseId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ itemId: string; movement: unknown }>>(Prisma.sql`
    SELECT itemId, SUM(ABS(quantityDelta)) AS movement
    FROM inventory_movements
    WHERE companyId = ${companyId}
      AND documentDate >= ${monthStart}
      AND documentDate <= ${todayEnd}
      ${warehouseSql}
    GROUP BY itemId
    ORDER BY movement DESC
    LIMIT 10
  `);
  return rows.map((row) => ({ itemId: row.itemId, movement: num(row.movement) }));
}

async function loadExpiry(companyId: string, today: Date, warehouseId?: string): Promise<ExpiryHit[]> {
  const windowEnd = endOfDayUtc(addDays(today.toISOString().slice(0, 10), 90), 'expiryTo');
  const lines = await prisma.invoiceLine.findMany({
    where: {
      invoice: { companyId, isPosted: true, isCancelled: false },
      OR: [{ expiryDate: { not: null, lte: windowEnd } }, { batchAllocations: { not: Prisma.DbNull } }],
    },
    select: {
      quantity: true,
      batchNumber: true,
      expiryDate: true,
      batchAllocations: true,
      warehouseId: true,
      itemId: true,
      item: { select: { arabicName: true, serial: true } },
      warehouse: { select: { arabicName: true } },
      invoice: {
        select: {
          invoiceKind: true,
          invoiceType: true,
          warehouseId: true,
          warehouse: { select: { arabicName: true } },
        },
      },
    },
  });

  const lots: Parameters<typeof expiryHitsFromLots>[0] = [];
  for (const line of lines) {
    const lineWarehouseId = line.warehouseId || line.invoice.warehouseId || '';
    if (!lineWarehouseId) continue;
    if (warehouseId && lineWarehouseId !== warehouseId) continue;
    const shared = {
      itemId: line.itemId,
      itemName: line.item?.arabicName || line.item?.serial || '',
      warehouseId: lineWarehouseId,
      warehouseName: line.warehouse?.arabicName || line.invoice.warehouse?.arabicName || '',
      side: lotSide(line.invoice),
    };
    const allocations = parseBatchAllocations(line.batchAllocations);
    if (allocations.length) {
      for (const allocation of allocations) {
        if (!allocation.quantity || allocation.expiryDate > windowEnd) continue;
        lots.push({
          ...shared,
          batchNumber: allocation.batchNumber || line.batchNumber || '',
          expiryDate: allocation.expiryDate,
          quantity: allocation.quantity,
        });
      }
      continue;
    }
    if (!line.expiryDate || line.expiryDate > windowEnd) continue;
    const quantity = Math.abs(num(line.quantity));
    if (!quantity) continue;
    lots.push({
      ...shared,
      batchNumber: line.batchNumber || '',
      expiryDate: line.expiryDate,
      quantity,
    });
  }

  const opening = await prisma.openingStockLine.findMany({
    where: {
      expiryDate: { not: null, lte: windowEnd },
      ...(warehouseId ? { warehouseId } : {}),
      openingStock: { companyId, isPosted: true, isCancelled: false },
    },
    select: {
      quantity: true,
      batchNumber: true,
      expiryDate: true,
      warehouseId: true,
      itemId: true,
      item: { select: { arabicName: true, serial: true } },
      warehouse: { select: { arabicName: true } },
    },
  });
  for (const line of opening) {
    if (!line.expiryDate) continue;
    const quantity = Math.abs(num(line.quantity));
    if (!quantity) continue;
    lots.push({
      itemId: line.itemId,
      itemName: line.item?.arabicName || line.item?.serial || '',
      warehouseId: line.warehouseId,
      warehouseName: line.warehouse?.arabicName || '',
      batchNumber: line.batchNumber || '',
      expiryDate: line.expiryDate,
      quantity,
      side: 'in',
    });
  }

  return expiryHitsFromLots(lots, today);
}

async function loadFacts(companyId: string, balances: BalanceRow[], topIds: string[]) {
  const itemIds = [...new Set([...balances.map((row) => row.itemId), ...topIds])];
  const warehouseIds = [...new Set(balances.map((row) => row.warehouseId))];
  const [items, warehouses, limits, activeWarehouses] = await Promise.all([
    itemIds.length
      ? prisma.item.findMany({
          where: { companyId, id: { in: itemIds } },
          select: { id: true, serial: true, arabicName: true, averageCost: true, orderLimit: true },
        })
      : [],
    warehouseIds.length
      ? prisma.warehouse.findMany({
          where: { companyId, id: { in: warehouseIds } },
          select: { id: true, arabicName: true },
        })
      : [],
    itemIds.length
      ? prisma.itemOrderLimitLine.findMany({
          where: {
            itemId: { in: itemIds },
            list: { companyId, isActive: true },
          },
          select: { itemId: true, orderLimit: true, list: { select: { warehouseId: true } } },
        })
      : [],
    prisma.warehouse.findMany({
      where: { companyId, isActive: true, warehouseKind: 'POSTING' },
      select: { id: true, arabicName: true },
      orderBy: { arabicName: 'asc' },
    }),
  ]);

  const itemFacts: ItemFact[] = items.map((row) => ({
    id: row.id,
    serial: row.serial ?? '',
    arabicName: row.arabicName,
    averageCost: num(row.averageCost),
    orderLimit: num(row.orderLimit),
  }));
  const seen = new Map<string, { id: string; arabicName: string }>();
  for (const row of [...activeWarehouses, ...warehouses]) seen.set(row.id, row);
  return {
    items: itemFacts,
    warehouses: [...seen.values()],
    limitOverrides: limits.map((row) => ({
      warehouseId: row.list.warehouseId,
      itemId: row.itemId,
      orderLimit: num(row.orderLimit),
    })),
  };
}

export const warehouseDashboardService = {
  async pulse(companyId: string, warehouseId?: string) {
    const today = utcToday();
    const todayEnd = endOfDayUtc(today, 'today');
    const monthStart = startOfDayUtc(`${today.slice(0, 8)}01`, 'month');
    const [balances, flows, topMoves, expiry, transferCount, transfers] = await Promise.all([
      loadBalances(companyId, todayEnd, warehouseId),
      loadFlows(companyId, monthStart, todayEnd, warehouseId),
      loadTopMoves(companyId, monthStart, todayEnd, warehouseId),
      loadExpiry(companyId, new Date(), warehouseId),
      prisma.transfer.count({
        where: {
          companyId,
          isPosted: false,
          isCancelled: false,
          ...(warehouseId
            ? { OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }] }
            : {}),
        },
      }),
      prisma.transfer.findMany({
        where: {
          companyId,
          isPosted: false,
          isCancelled: false,
          ...(warehouseId
            ? { OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }] }
            : {}),
        },
        orderBy: { date: 'desc' },
        take: 8,
        select: {
          id: true,
          serial: true,
          date: true,
          fromWarehouse: { select: { arabicName: true } },
          toWarehouse: { select: { arabicName: true } },
        },
      }),
    ]);
    const facts = await loadFacts(companyId, balances, topMoves.map((row) => row.itemId));
    return assembleWarehousePulse({
      today,
      monthStart: monthStart.toISOString().slice(0, 10),
      balances,
      flows,
      topMoves,
      expiry,
      unpostedTransferCount: transferCount,
      transfers: transfers.map((row) => ({
        id: row.id,
        serial: row.serial?.trim() || row.id.slice(0, 8),
        date: row.date.toISOString(),
        fromName: row.fromWarehouse.arabicName,
        toName: row.toWarehouse.arabicName,
      })),
      ...facts,
    });
  },

  async compare(companyId: string) {
    const today = utcToday();
    const todayEnd = endOfDayUtc(today, 'today');
    const monthStart = startOfDayUtc(`${today.slice(0, 8)}01`, 'month');
    const deadBefore = new Date(todayEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
    const [balances, flows, expiry] = await Promise.all([
      loadBalances(companyId, todayEnd),
      loadFlows(companyId, monthStart, todayEnd),
      loadExpiry(companyId, new Date()),
    ]);
    const facts = await loadFacts(companyId, balances, []);
    return assembleWarehouseCompare({
      balances,
      items: facts.items,
      warehouses: facts.warehouses,
      flows,
      expiry,
      deadBefore,
    });
  },
};
