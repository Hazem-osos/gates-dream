import { fetchWarehouseAverageCost } from '@/lib/inventory/fetch-warehouse-stock-balance';

export type AssemblyPricingMethod = 'AVERAGE_COST' | 'LAST_PURCHASE' | 'MANUAL';

export const ASSEMBLY_PRICING_METHOD_OPTIONS: Array<{
  value: AssemblyPricingMethod;
  label: string;
}> = [
  { value: 'AVERAGE_COST', label: 'متوسط التكلفة' },
  { value: 'LAST_PURCHASE', label: 'آخر شراء' },
  { value: 'MANUAL', label: 'تسعير يدوي' },
];

export type AssemblyPricingItemBases = {
  averageCost?: number | string | null;
  lastPurchasePrice?: number | string | null;
};

export function catalogItemForAsOfAverageCost(
  item: AssemblyPricingItemBases | null | undefined,
  asOfDate?: string
): AssemblyPricingItemBases | null {
  return asOfDate?.trim() ? null : (item ?? null);
}

export function resolveAssemblyUnitCost(
  method: AssemblyPricingMethod,
  item?: AssemblyPricingItemBases | null,
  warehouseAverageCost?: number | null
): number {
  if (method === 'MANUAL') return 0;
  if (method === 'LAST_PURCHASE') {
    const last = Number(item?.lastPurchasePrice ?? 0);
    if (Number.isFinite(last) && last > 0) return last;
    const avg = Number(item?.averageCost ?? 0);
    return Number.isFinite(avg) && avg > 0 ? avg : 0;
  }
  const avg = Number(item?.averageCost ?? 0);
  if (Number.isFinite(avg) && avg > 0) return avg;
  const wh = Number(warehouseAverageCost ?? 0);
  return Number.isFinite(wh) && wh > 0 ? wh : 0;
}

/** Average cost for stock vouchers / adjustments (item MAC, then warehouse copy). */
export async function resolveWarehouseAverageUnitCost(
  itemId: string,
  warehouseId: string | undefined,
  item?: AssemblyPricingItemBases | null,
  asOfDate?: string
): Promise<number> {
  let warehouseAvg: number | null = null;
  if (itemId && warehouseId) {
    try {
      const wh = await fetchWarehouseAverageCost(itemId, warehouseId, asOfDate);
      warehouseAvg = wh > 0 ? wh : null;
    } catch {
      warehouseAvg = null;
    }
  }
  return resolveAssemblyUnitCost(
    'AVERAGE_COST',
    catalogItemForAsOfAverageCost(item, asOfDate),
    warehouseAvg
  );
}
