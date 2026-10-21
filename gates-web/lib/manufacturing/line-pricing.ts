import { resolveAssemblyUnitCost } from '@/lib/inventory/assembly-pricing';

export type ManufacturingLinePricingPolicy = 'AVERAGE_COST' | 'LAST_PURCHASE' | 'MANUAL';

export const MANUFACTURING_LINE_PRICING_OPTIONS: Array<{
  value: ManufacturingLinePricingPolicy;
  label: string;
  hint: string;
}> = [
  {
    value: 'AVERAGE_COST',
    label: 'تلقائي — متوسط التكلفة',
    hint: 'سعر الخامة يُعبّى من متوسط التكلفة المرجح للصنف.',
  },
  {
    value: 'LAST_PURCHASE',
    label: 'تلقائي — آخر سعر (غير مفضّل)',
    hint: 'آخر سعر شراء غالباً غير عملي. الأفضل متوسط التكلفة أو التسعير اليدوي.',
  },
  {
    value: 'MANUAL',
    label: 'تسعير يدوي',
    hint: 'تكتب سعر الخامة بنفسك في عملية التصنيع ونموذج التصنيع.',
  },
];

export type ManufacturingPricedItem = {
  averageCost?: number | string | null;
  lastPurchasePrice?: number | string | null;
};

export function parseManufacturingLinePricingPolicy(value: unknown): ManufacturingLinePricingPolicy {
  if (value === 'LAST_PURCHASE' || value === 'MANUAL') return value;
  return 'AVERAGE_COST';
}

export function resolveManufacturingLineUnitPrice(
  policy: ManufacturingLinePricingPolicy,
  item?: ManufacturingPricedItem | null
): number {
  return resolveAssemblyUnitCost(policy, item ?? null);
}
