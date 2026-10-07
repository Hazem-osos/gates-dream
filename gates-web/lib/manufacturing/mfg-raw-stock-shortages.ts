import { apiClient } from '@/lib/api/client';
import type { ProcessRawRow } from '@/lib/manufacturing/process-from-bom';

export type MfgStockShortage = {
  itemId: string;
  itemName: string;
  warehouseId: string;
  required: number;
  available: number;
  shortage: number;
};

export async function findMfgRawStockShortages(
  rows: ProcessRawRow[],
  defaultWarehouseId: string
): Promise<MfgStockShortage[]> {
  const shortages: MfgStockShortage[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const warehouseId = row.warehouseId || defaultWarehouseId;
    if (!warehouseId || !row.itemId) continue;
    const key = `${row.itemId}:${warehouseId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const res = await apiClient.get<{ availableQuantity?: number; quantityOnHand?: number }>(
      `/inventory/items/${row.itemId}/stock-balance`,
      { warehouseId }
    );
    const available = Number(
      res.data?.availableQuantity ?? res.data?.quantityOnHand ?? 0
    );
    const required = row.quantity;
    if (!Number.isFinite(available) || required <= available + 1e-6) continue;
    shortages.push({
      itemId: row.itemId,
      itemName: row.itemName,
      warehouseId,
      required,
      available,
      shortage: required - available,
    });
  }

  return shortages;
}

export const COMPANY_NEGATIVE_STOCK_SETTINGS_HREF =
  '/accounting-settings/company-settings/accounting-settings';

export function formatMfgShortageBlock(shortages: MfgStockShortage[], max = 4): string {
  const slice = shortages.slice(0, max);
  const lines = slice.map(
    (s) => `«${s.itemName}»: متاح ${s.available.toLocaleString('ar-EG')} — مطلوب ${s.required.toLocaleString('ar-EG')}`
  );
  const more = shortages.length > max ? ` (+${shortages.length - max} صنف آخر)` : '';
  return lines.join(' · ') + more;
}
