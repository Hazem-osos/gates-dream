import type { PriceTier } from '@prisma/client';

export type TierPriceFields = {
  priceRetail?: number | string | null;
  priceSemiWholesale?: number | string | null;
  priceWholesale?: number | string | null;
  priceProjects?: number | string | null;
};

function num(v: number | string | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function resolveUnitPrice(
  priceTier: PriceTier | string | null | undefined,
  item: TierPriceFields
): number {
  const tier = (priceTier ?? 'RETAIL') as PriceTier;
  switch (tier) {
    case 'SEMI_WHOLESALE':
      return num(item.priceSemiWholesale);
    case 'WHOLESALE':
      return num(item.priceWholesale);
    case 'PROJECTS':
      return num(item.priceProjects);
    case 'RETAIL':
    default:
      return num(item.priceRetail);
  }
}

export function tierStandardPrice(
  priceTier: PriceTier | string | null | undefined,
  item: TierPriceFields
): number {
  return resolveUnitPrice(priceTier, item);
}

export function priceDeviation(
  unitPrice: number,
  priceTier: PriceTier | string | null | undefined,
  item: TierPriceFields
): { standard: number; delta: number; pct: number | null } {
  const standard = tierStandardPrice(priceTier, item);
  if (standard <= 0) {
    return { standard: 0, delta: 0, pct: null };
  }
  const delta = unitPrice - standard;
  const pct = (delta / standard) * 100;
  return { standard, delta, pct };
}

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  RETAIL: 'قطاعي',
  SEMI_WHOLESALE: 'نصف جملة',
  WHOLESALE: 'جملة',
  PROJECTS: 'مشاريع',
};
