import { applyPriceListMode, listedPurchaseAmount, listedSaleAmount } from './price-list-mode';

export type PriceListPricingKind = 'sale' | 'purchase';

export function parsePartyDiscountPercent(raw?: string | null): number {
  const cleaned = String(raw ?? '').replace(/%/g, '').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.min(100, n) : 0;
}

/** Line discount + list header discount + optional party card discount (customer/supplier). */
export function combinedPriceListDiscountPercent(params: {
  lineDiscount?: unknown;
  listDiscountPercentage?: unknown;
  partyDiscountRaw?: string | null;
}): number {
  const line = Number(params.lineDiscount ?? 0);
  const header = Number(params.listDiscountPercentage ?? 0);
  const party = parsePartyDiscountPercent(params.partyDiscountRaw);
  const sum =
    (Number.isFinite(line) && line > 0 ? line : 0) +
    (Number.isFinite(header) && header > 0 ? header : 0) +
    party;
  return Math.min(100, Math.max(0, sum));
}

export function resolveUnitPriceFromPriceListRow(
  kind: PriceListPricingKind,
  row: {
    price?: unknown;
    retailPrice?: unknown;
    purchasePrice?: unknown;
    priceList?: { priceMode?: string | null } | null;
  },
  bases: { cost?: number | null; lastPurchase?: number | null }
): number {
  const listed =
    kind === 'purchase' ? listedPurchaseAmount(row) : listedSaleAmount(row);
  return applyPriceListMode(listed, row.priceList?.priceMode, bases);
}
