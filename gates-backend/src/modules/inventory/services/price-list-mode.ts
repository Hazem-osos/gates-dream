export type PriceListMode = 'value' | 'cost' | 'last';

export function listedSaleAmount(row: {
  price?: unknown;
  retailPrice?: unknown;
}): number {
  const retail = Number(row.retailPrice ?? 0);
  if (Number.isFinite(retail) && retail > 0) return retail;
  const price = Number(row.price ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

/** value = listed amount; cost/last = listed number is a percent of the base. */
export function applyPriceListMode(
  listed: number,
  mode: string | null | undefined,
  bases: { cost?: number | null; lastPurchase?: number | null }
): number {
  if (!Number.isFinite(listed) || listed <= 0) return 0;
  const kind = mode === 'cost' || mode === 'last' ? mode : 'value';
  if (kind === 'cost') {
    const cost = Number(bases.cost ?? 0);
    return cost > 0 ? roundMoney(cost * (listed / 100)) : 0;
  }
  if (kind === 'last') {
    const last = Number(bases.lastPurchase ?? 0);
    return last > 0 ? roundMoney(last * (listed / 100)) : 0;
  }
  return roundMoney(listed);
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}
