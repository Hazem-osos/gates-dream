import { money, rate } from '../utils/money-decimal';

/** Selling = Cost × (1 + markupRate) */
export function sellingFromCostPlusMarkup(directUnitCost: number, markupRate: number) {
  return money(directUnitCost * (1 + markupRate)).toNumber();
}

/** Notebook / technical-office stack: direct × (1+OH+site+risk) × (1+profit) × (1+tax) */
export function sellingFromStackedStudy(
  directUnitCost: number,
  rates: {
    generalOverheadRate: number;
    siteOverheadRate: number;
    contingencyRiskRate: number;
    profitMarginRate: number;
    contractTaxesRate: number;
  }
) {
  const loaded = directUnitCost * (1 + rates.generalOverheadRate + rates.siteOverheadRate + rates.contingencyRiskRate);
  return money(loaded * (1 + rates.profitMarginRate) * (1 + rates.contractTaxesRate)).toNumber();
}

export function isTenderHeaderKind(kind?: string | null) {
  return kind === 'SEASON' || kind === 'CHAPTER' || kind === 'OFFICIAL';
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
