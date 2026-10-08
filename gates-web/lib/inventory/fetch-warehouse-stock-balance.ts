import { apiClient } from '@/lib/api/client';

type StockBalancePayload = {
  quantityOnHand?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  averageCost?: number;
};

/** Saleable quantity in one warehouse (on-hand minus reservations). */
export async function fetchWarehouseAvailableQuantity(
  itemId: string,
  warehouseId: string
): Promise<number> {
  const res = await apiClient.get<StockBalancePayload>(
    `/inventory/items/${itemId}/stock-balance`,
    { warehouseId }
  );
  const row = res.data;
  if (row?.availableQuantity != null && Number.isFinite(Number(row.availableQuantity))) {
    return Number(row.availableQuantity);
  }
  const onHand = Number(row?.quantityOnHand ?? 0);
  const reserved = Number(row?.reservedQuantity ?? 0);
  return Math.max(0, onHand - reserved);
}

/** Warehouse-level average cost from item_warehouse_balances (falls back to 0). */
export async function fetchWarehouseAverageCost(
  itemId: string,
  warehouseId: string
): Promise<number> {
  const res = await apiClient.get<StockBalancePayload>(
    `/inventory/items/${itemId}/stock-balance`,
    { warehouseId }
  );
  const avg = Number(res.data?.averageCost ?? 0);
  return Number.isFinite(avg) && avg > 0 ? avg : 0;
}

export function availableFromItemOption(item: {
  availableQuantity?: number | null;
  onHandQuantity?: number | null;
  quantityOnHand?: number | null;
  reservedQuantity?: number | null;
}): number | null {
  if (item.availableQuantity != null && Number.isFinite(Number(item.availableQuantity))) {
    return Number(item.availableQuantity);
  }
  if (item.onHandQuantity != null && Number.isFinite(Number(item.onHandQuantity))) {
    return Number(item.onHandQuantity);
  }
  if (item.quantityOnHand != null && item.reservedQuantity != null) {
    return Math.max(0, Number(item.quantityOnHand) - Number(item.reservedQuantity));
  }
  return null;
}
