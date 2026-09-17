export type CostCenterKindValue = 'HEADER' | 'POSTING';

export function resolveCreateCostCenterKind(input: {
  parentId?: string | null;
  costCenterKind?: CostCenterKindValue | null;
}): CostCenterKindValue {
  if (!input.parentId) return 'HEADER';
  return input.costCenterKind === 'HEADER' ? 'HEADER' : 'POSTING';
}

export function isHeaderCostCenterKind(kind: string | null | undefined): boolean {
  return kind === 'HEADER';
}

export function isPostingCostCenterKind(kind: string | null | undefined): boolean {
  return kind !== 'HEADER';
}
