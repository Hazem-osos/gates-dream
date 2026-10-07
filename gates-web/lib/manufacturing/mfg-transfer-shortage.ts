import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';

export type MfgTransferLineInput = {
  itemId: string;
  quantity: number;
  itemName?: string;
  warehouseId?: string;
};

type StockBalanceRow = {
  availableQuantity?: number;
  quantityOnHand?: number;
};

async function fetchAvailableQty(itemId: string, warehouseId: string): Promise<number> {
  try {
    const res = await apiClient.get<StockBalanceRow>(`/inventory/items/${itemId}/stock-balance`, {
      warehouseId,
    });
    const row = res.data;
    const available = Number(row?.availableQuantity ?? row?.quantityOnHand ?? 0);
    return Number.isFinite(available) ? available : 0;
  } catch {
    return 0;
  }
}

/** Lines with quantity = shortage (required − available) per warehouse. */
export async function buildShortageTransferLines(
  rows: MfgTransferLineInput[],
  defaultWarehouseId: string
): Promise<Array<{ itemId: string; quantity: number; itemName?: string }>> {
  const out: Array<{ itemId: string; quantity: number; itemName?: string }> = [];

  for (const row of rows) {
    const wh = row.warehouseId?.trim() || defaultWarehouseId;
    if (!wh || !row.itemId) continue;
    const required = Number(row.quantity);
    if (!Number.isFinite(required) || required <= 0) continue;
    const balance = await fetchAvailableQty(row.itemId, wh);
    const shortage = Math.max(0, required - balance);
    if (shortage <= 0.0001) continue;
    out.push({
      itemId: row.itemId,
      quantity: Math.round(shortage * 10000) / 10000,
      itemName: row.itemName,
    });
  }

  return out;
}

export function shortageTransferError(err: unknown): string {
  return (err as ApiError).message || 'تعذر حساب عجز الكميات';
}
