export const SELL_BELOW_COST_MESSAGE =
  'غير مسموح بالبيع بأقل من سعر التكلفة بناءً على إعدادات الشركة';

export type BelowCostLine = {
  itemId: string;
  price: number;
  arabicName?: string | null;
};

export type BelowCostItemFlag = {
  id: string;
  noSellBelowCost: boolean;
  arabicName: string | null;
  averageCost: number;
};

export function isSellingBelowCost(unitPrice: number, averageCost: number): boolean {
  return averageCost > 0 && unitPrice + 1e-6 < averageCost;
}

export function findBelowCostViolation(
  lines: BelowCostLine[],
  costs: Map<string, number>,
  itemFlags: Map<string, BelowCostItemFlag>,
  companyWide: boolean
): (BelowCostLine & { cost: number }) | null {
  for (const line of lines) {
    const item = itemFlags.get(line.itemId);
    if (!companyWide && !item?.noSellBelowCost) continue;
    const cost = costs.get(line.itemId) ?? Number(item?.averageCost ?? 0);
    if (isSellingBelowCost(line.price, cost)) {
      return { ...line, cost };
    }
  }
  return null;
}
