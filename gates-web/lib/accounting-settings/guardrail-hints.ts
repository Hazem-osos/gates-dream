export const SELL_BELOW_COST_MESSAGE =
  'غير مسموح بالبيع بأقل من سعر التكلفة بناءً على إعدادات الشركة';

/** Mirrors backend `resolveSellingCostFloor`. */
export function resolveItemCostFloor(item?: {
  averageCost?: number | string | null;
  lastPurchasePrice?: number | string | null;
} | null): number {
  const averageCost = Number(item?.averageCost ?? 0);
  if (averageCost > 0) return averageCost;
  const lastPurchase = Number(item?.lastPurchasePrice ?? 0);
  return lastPurchase > 0 ? lastPurchase : 0;
}

/** Mirrors backend `isSellingBelowCost` — used for live invoice-line badges. */
export function isPriceBelowAverageCost(unitPrice: number, averageCost: number): boolean {
  return averageCost > 0 && unitPrice + 1e-6 < averageCost;
}

export function findBelowCostLine<T extends { itemId?: string; unitPrice?: number | string | null }>(
  lines: T[],
  items: Array<{
    id: string;
    averageCost?: number | string | null;
    lastPurchasePrice?: number | string | null;
  }>
): T | null {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const line of lines) {
    if (!line.itemId) continue;
    const cost = resolveItemCostFloor(byId.get(line.itemId));
    if (isPriceBelowAverageCost(Number(line.unitPrice ?? 0), cost)) return line;
  }
  return null;
}

/** Mirrors backend cash-overdraft check — used for live treasury warnings. */
export function isCashAmountOverBalance(amount: number, balance: number): boolean {
  return amount > 0 && balance + 1e-6 < amount;
}

export function formatTreasuryBalanceLabel(
  name: string,
  balance: number | string | null | undefined
): string {
  const n = Number(balance ?? 0);
  return `${name} — رصيد ${n.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
