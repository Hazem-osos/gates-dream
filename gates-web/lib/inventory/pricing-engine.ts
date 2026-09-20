export type PriceTier = 'RETAIL' | 'SEMI_WHOLESALE' | 'WHOLESALE' | 'PROJECTS';
export type PriceListMode = 'value' | 'cost' | 'last';

export type PriceListPriceRow = {
  price?: number | null;
  retailPrice?: number | string | null;
  unitId?: string | null;
  priceList?: {
    id?: string;
    priceMode?: string | null;
    isActive?: boolean | null;
    isDefault?: boolean | null;
  } | null;
};

export type PriceListItemBases = {
  averageCost?: number | string | null;
  lastPurchasePrice?: number | string | null;
};

function money(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function applyPriceListMode(
  listed: number,
  mode: string | null | undefined,
  bases: PriceListItemBases
): number {
  if (!Number.isFinite(listed) || listed <= 0) return 0;
  if (mode === 'cost') {
    const cost = Number(bases.averageCost ?? 0);
    return cost > 0 ? money(cost * (listed / 100)) : 0;
  }
  if (mode === 'last') {
    const last = Number(bases.lastPurchasePrice ?? 0);
    return last > 0 ? money(last * (listed / 100)) : 0;
  }
  return money(listed);
}

export function resolvePriceListSalePrice(
  item: PriceListItemBases & { itemPrices?: PriceListPriceRow[] | null },
  priceListId?: string | null,
  unitId?: string | null
): number {
  const rows = (item.itemPrices ?? []).filter((row) => row.priceList?.isActive !== false);
  const listedOf = (row: PriceListPriceRow) => {
    const retail = Number(row.retailPrice ?? 0);
    if (Number.isFinite(retail) && retail > 0) return retail;
    const price = Number(row.price ?? 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
  };
  const pick =
    (priceListId
      ? rows.find((row) => row.priceList?.id === priceListId && (!unitId || row.unitId === unitId)) ||
        rows.find((row) => row.priceList?.id === priceListId)
      : undefined) ||
    rows.find((row) => row.priceList?.isDefault) ||
    (rows.length === 1 ? rows[0] : undefined);
  if (!pick) return 0;
  return applyPriceListMode(listedOf(pick), pick.priceList?.priceMode, item);
}

export type TierPriceFields = {
  priceRetail?: number | null;
  priceSemiWholesale?: number | null;
  priceWholesale?: number | null;
  priceProjects?: number | null;
};

function num(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return v;
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
