import { toMoney } from '@/lib/subcontracts/money';

export function contractAdvancePercent(
  advance: string | number | null | undefined,
  total: string | number | null | undefined
): number {
  const totalValue = toMoney(total);
  if (!(totalValue > 0)) return 0;
  return Math.round((toMoney(advance) / totalValue) * 10000) / 100;
}

export function contractAdvanceAmountFromPercent(
  percent: string | number | null | undefined,
  total: string | number | null | undefined
): number {
  const totalValue = toMoney(total);
  if (!(totalValue > 0)) return 0;
  return Math.round(totalValue * (toMoney(percent) / 100) * 100) / 100;
}
