import { apiClient } from '@/lib/api/client';

export const STOCKTAKING_QTY_EPS = 0.000_5;

export type WarehouseBalanceRow = {
  itemId?: string;
  quantity?: number | string;
  quantityOnHand?: number | string;
  averageCost?: number | string;
  item?: {
    averageCost?: unknown;
    lastPurchasePrice?: unknown;
  };
};

export type WarehouseBalanceSnapshot = {
  quantityOnHand: number;
  averageUnitCost: number;
};

export type StocktakingBookDrift = {
  itemId: string;
  bookOnScreen: number;
  liveInWarehouse: number;
};

export type StocktakingLineLike = {
  itemId: string;
  bookValue: number;
  actualValue: number;
  averageUnitCost: number;
  unitPrice: number;
};

function unitCostFromRow(row: WarehouseBalanceRow): number {
  const warehouseCost = Number(row.averageCost);
  if (Number.isFinite(warehouseCost) && warehouseCost > 0) return warehouseCost;
  const itemCost = Number(row.item?.averageCost ?? row.item?.lastPurchasePrice);
  return Number.isFinite(itemCost) && itemCost > 0 ? itemCost : 0;
}

export function warehouseBalanceMapFromRows(
  rows: WarehouseBalanceRow[]
): Map<string, WarehouseBalanceSnapshot> {
  const map = new Map<string, WarehouseBalanceSnapshot>();
  for (const row of rows) {
    const itemId = String(row.itemId ?? '').trim();
    if (!itemId) continue;
    map.set(itemId, {
      quantityOnHand: Number(row.quantityOnHand ?? row.quantity) || 0,
      averageUnitCost: unitCostFromRow(row),
    });
  }
  return map;
}

export async function fetchWarehouseBalanceMap(
  warehouseId: string,
  asOfDate?: string
): Promise<Map<string, WarehouseBalanceSnapshot>> {
  const date = asOfDate?.trim().slice(0, 10);
  const res = await apiClient.get<WarehouseBalanceRow[]>(
    `/inventory/item-quantities/warehouse/${warehouseId}`,
    date ? { date } : undefined
  );
  const rows = Array.isArray(res.data) ? res.data : [];
  return warehouseBalanceMapFromRows(rows);
}

export function diffBookFromWarehouse(
  lines: StocktakingLineLike[],
  liveByItem: Map<string, WarehouseBalanceSnapshot>
): StocktakingBookDrift[] {
  const drifts: StocktakingBookDrift[] = [];
  for (const line of lines) {
    const itemId = line.itemId?.trim();
    if (!itemId) continue;
    const live = liveByItem.get(itemId)?.quantityOnHand ?? 0;
    if (Math.abs(line.bookValue - live) <= STOCKTAKING_QTY_EPS) continue;
    drifts.push({
      itemId,
      bookOnScreen: line.bookValue,
      liveInWarehouse: live,
    });
  }
  return drifts;
}

type ItemLabel = { id: string; code?: string | null; serial?: string | null; arabicName?: string };

export function formatStocktakingDriftMessage(
  drifts: StocktakingBookDrift[],
  catalog: ItemLabel[],
  maxLines = 12
): string {
  const byId = new Map(catalog.map((row) => [row.id, row]));
  const lines = drifts.slice(0, maxLines).map((d) => {
    const item = byId.get(d.itemId);
    const label =
      item?.arabicName?.trim() ||
      item?.code?.trim() ||
      item?.serial?.trim() ||
      d.itemId.slice(0, 8);
    return `• ${label}: دفتري ${d.bookOnScreen} — مخزن ${d.liveInWarehouse}`;
  });
  const more = drifts.length > maxLines ? `\n… و${drifts.length - maxLines} صنف آخر` : '';
  return `${lines.join('\n')}${more}`;
}

export function applyAsOfAverageCosts<T extends StocktakingLineLike>(
  lines: T[],
  liveByItem: Map<string, WarehouseBalanceSnapshot>
): T[] {
  return lines.map((line) => {
    const itemId = line.itemId?.trim();
    if (!itemId) return line;
    const avg = liveByItem.get(itemId)?.averageUnitCost ?? 0;
    const priceFollowsAvg =
      line.unitPrice === 0 || Math.abs(line.unitPrice - line.averageUnitCost) < 1e-6;
    return {
      ...line,
      averageUnitCost: avg,
      unitPrice: priceFollowsAvg ? avg : line.unitPrice,
    };
  });
}

export function applyLiveBookBalances<T extends StocktakingLineLike>(
  lines: T[],
  liveByItem: Map<string, WarehouseBalanceSnapshot>,
  opts: { keepActual: boolean }
): { lines: T[]; updatedCount: number } {
  let updatedCount = 0;
  const next = lines.map((line) => {
    const itemId = line.itemId?.trim();
    if (!itemId) return line;
    const snap = liveByItem.get(itemId);
    const bookValue = snap?.quantityOnHand ?? 0;
    const avg =
      snap?.averageUnitCost && snap.averageUnitCost > 0
        ? snap.averageUnitCost
        : line.averageUnitCost;
    if (Math.abs(line.bookValue - bookValue) > STOCKTAKING_QTY_EPS) updatedCount += 1;
    const actualValue = opts.keepActual ? line.actualValue : bookValue;
    const delta = actualValue - bookValue;
    return {
      ...line,
      bookValue,
      actualValue,
      averageUnitCost: avg,
      shortage: delta < 0 ? -delta : 0,
      surplus: delta > 0 ? delta : 0,
      unitPrice: line.unitPrice > 0 ? line.unitPrice : avg,
    };
  });
  return { lines: next, updatedCount };
}
