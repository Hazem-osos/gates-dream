/** Mirrors backend `isSellingBelowCost` — used for live invoice-line badges. */
export function isPriceBelowAverageCost(unitPrice: number, averageCost: number): boolean {
  return averageCost > 0 && unitPrice + 1e-6 < averageCost;
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
