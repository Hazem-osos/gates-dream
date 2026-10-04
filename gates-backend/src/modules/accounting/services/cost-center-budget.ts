import { roundTo4 } from '../../../shared/utils/decimal-round';
import { splitTrialBalanceColumns } from './financial-report.util';

export type CostCenterBudgetSource = {
  id: string;
  code: string;
  arabicName: string;
  parentId: string | null;
  budget: number;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
};

export type CostCenterBudgetRow = {
  accountId: string;
  accountPath: string;
  code: string;
  account: string;
  classification: string;
  budgetLevel: number;
  budgetDebit: number;
  budgetCredit: number;
  openingDebit: number;
  openingCredit: number;
  endingDebit: number;
  endingCredit: number;
  remaining: number;
  negativeVariance: number;
  remainingPercent: number;
  variancePercent: number;
  centerVariancePercent: number;
  totalVariancePercent: number;
  budgetValue: number;
  actual: number;
  variance: number;
};

/**
 * Same columns as the account budget sheet. Each posting cost center is a row:
 * its own budget against the net of its journal lines.
 */
export function buildCostCenterBudgetRows(
  centers: CostCenterBudgetSource[],
  tree: Array<{ id: string; parentId: string | null; arabicName: string }>
): CostCenterBudgetRow[] {
  const byId = new Map(tree.map((center) => [center.id, center]));
  return centers.flatMap((center) => {
    const openingDebit = roundTo4(center.openingDebit);
    const openingCredit = roundTo4(center.openingCredit);
    const periodDebit = roundTo4(center.periodDebit);
    const periodCredit = roundTo4(center.periodCredit);
    const budgetValue = roundTo4(center.budget);
    if (!budgetValue && !openingDebit && !openingCredit && !periodDebit && !periodCredit) return [];

    const actual = roundTo4(periodDebit - periodCredit);
    const remaining = roundTo4(budgetValue - actual);
    const negativeVariance = roundTo4(remaining < 0 ? -remaining : 0);
    const remainingPercent = budgetValue ? roundTo4((remaining / budgetValue) * 100) : 0;
    const variancePercent = budgetValue ? roundTo4((negativeVariance / budgetValue) * 100) : 0;
    const ending = splitTrialBalanceColumns(openingDebit - openingCredit + periodDebit - periodCredit);

    const pathParts: string[] = [];
    let depth = 1;
    let cursor = byId.get(center.id);
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      pathParts.unshift(cursor.arabicName);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
      if (cursor) depth += 1;
    }

    return [{
      accountId: center.id,
      accountPath: pathParts.join(' › '),
      code: center.code,
      account: center.arabicName,
      classification: 'مركز تكلفة',
      budgetLevel: depth,
      budgetDebit: budgetValue,
      budgetCredit: 0,
      openingDebit,
      openingCredit,
      endingDebit: ending.endingDebit,
      endingCredit: ending.endingCredit,
      remaining,
      negativeVariance,
      remainingPercent,
      variancePercent,
      centerVariancePercent: variancePercent,
      totalVariancePercent: variancePercent,
      budgetValue,
      actual,
      variance: roundTo4(actual - budgetValue),
    }];
  });
}
