import { money, rate } from '../utils/money-decimal';

/** Selling = Cost × (1 + markupRate) */
export function sellingFromCostPlusMarkup(directUnitCost: number, markupRate: number) {
  return money(directUnitCost * (1 + markupRate)).toNumber();
}

/** Selling = Cost / (1 - marginRate); marginRate in 0..1 */
export function sellingFromTargetMargin(directUnitCost: number, marginRate: number) {
  if (marginRate >= 1) throw new Error('INVALID_TARGET_MARGIN');
  return money(directUnitCost / (1 - marginRate)).toNumber();
}

/** Margin % = (Selling - Cost) / Selling × 100 (not markup on cost). */
export function marginPercentFromSelling(directCost: number, selling: number): number | null {
  if (selling <= 0) return null;
  return rate(money((selling - directCost) / selling).mul(100)).toNumber();
}

export function markupPercentFromSelling(directCost: number, selling: number): number | null {
  if (directCost <= 0) return null;
  return rate(money((selling - directCost) / directCost).mul(100)).toNumber();
}
