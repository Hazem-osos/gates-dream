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
  const wh = Number(warehouseAverageCost ?? 0);
  if (Number.isFinite(wh) && wh > 0) return wh;
  const avg = Number(item?.averageCost ?? 0);
  return Number.isFinite(avg) && avg > 0 ? avg : 0;
}
