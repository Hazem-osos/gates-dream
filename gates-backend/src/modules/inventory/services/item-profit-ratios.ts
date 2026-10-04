function ratioPercent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

/** Sales margin, markup on cost, and this item's share of the report profit. */
export function itemProfitRatios(
  row: { totalProfit: number; totalSales: number; totalCost: number },
  overallProfit: number
) {
  return {
    profitPercentOnSales: ratioPercent(row.totalProfit, row.totalSales),
    profitPercentOnCost: ratioPercent(row.totalProfit, row.totalCost),
    profitPercentOnTotal: ratioPercent(row.totalProfit, overallProfit),
  };
}
