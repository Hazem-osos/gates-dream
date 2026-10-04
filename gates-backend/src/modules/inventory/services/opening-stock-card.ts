/** Card display for opening qty and unit cost, summed from opening-stock lines. */
export function openingFiguresFromSums(
  quantity: unknown,
  total: unknown
): { beginningBalance: number | null; beginningCostPrice: number | null } {
  const qty = Number(quantity ?? 0);
  const value = Number(total ?? 0);
  if (!Number.isFinite(qty) || !(qty > 0)) {
    return { beginningBalance: null, beginningCostPrice: null };
  }
  const cost = Number.isFinite(value) ? value / qty : 0;
  return {
    beginningBalance: qty,
    beginningCostPrice: Math.round(cost * 100) / 100,
  };
}
