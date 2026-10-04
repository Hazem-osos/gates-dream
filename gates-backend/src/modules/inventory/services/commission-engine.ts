export type CommissionRule = 'عمولة كمية الصنف' | 'شرائح أيام التحصيل' | 'سياسة الهدف' | 'نسبة المندوب' | 'بدون نسبة';

export interface CommissionInput {
  sign: number;
  netAmount: number;
  collectionDays: number;
  paymentMethod?: string | null;
  commissionPercentage?: number | null;
  lines: Array<{ itemId: string; lineNet: number }>;
  quantityRates: Array<{
    itemId?: string | null;
    percent?: number | null;
    cashRate?: number | null;
    creditRate?: number | null;
  }>;
  valueTiers: Array<{ days?: number | null; commissionPct?: number | null }>;
  policyTiers: Array<{ targetPct?: number | null; commissionPct?: number | null }>;
  achievementPct?: number | null;
}

export function resolveCommission(input: CommissionInput): { amount: number; rule: CommissionRule } {
  const cash = (input.paymentMethod ?? '').toLowerCase() === 'cash';
  let quantityCommission = 0;
  let usedQuantity = false;
  for (const line of input.lines) {
    const rate = input.quantityRates.find((row) => row.itemId && row.itemId === line.itemId);
    if (!rate) continue;
    const pct = cash
      ? Number(rate.cashRate ?? rate.percent ?? 0)
      : Number(rate.creditRate ?? rate.percent ?? 0);
    if (pct === 0) continue;
    usedQuantity = true;
    quantityCommission += line.lineNet * (pct / 100);
  }
  if (usedQuantity) {
    return { amount: input.sign * quantityCommission, rule: 'عمولة كمية الصنف' };
  }

  const tiers = [...input.valueTiers].filter((row) => row.commissionPct != null);
  if (tiers.length) {
    const sorted = tiers.sort((a, b) => Number(a.days ?? 0) - Number(b.days ?? 0));
    const match = sorted.find((row) => input.collectionDays <= Number(row.days ?? 0)) ?? sorted[sorted.length - 1];
    const pct = Number(match?.commissionPct ?? 0);
    if (pct !== 0) {
      return { amount: input.sign * input.netAmount * (pct / 100), rule: 'شرائح أيام التحصيل' };
    }
  }

  if (input.achievementPct != null && input.policyTiers.length) {
    const sorted = [...input.policyTiers].sort((a, b) => Number(a.targetPct ?? 0) - Number(b.targetPct ?? 0));
    const match = [...sorted].reverse().find((row) => input.achievementPct! >= Number(row.targetPct ?? 0)) ?? sorted[0];
    const pct = Number(match?.commissionPct ?? 0);
    if (pct !== 0) {
      return { amount: input.sign * input.netAmount * (pct / 100), rule: 'سياسة الهدف' };
    }
  }

  const flat = Number(input.commissionPercentage ?? 0);
  if (flat !== 0) {
    return { amount: input.sign * input.netAmount * (flat / 100), rule: 'نسبة المندوب' };
  }
  return { amount: 0, rule: 'بدون نسبة' };
}
