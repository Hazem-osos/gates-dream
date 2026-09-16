export type AccountKindValue = 'HEADER' | 'POSTING';

export function isHeaderAccountKind(kind: string | null | undefined): boolean {
  return kind === 'HEADER';
}

export function isPostingAccountKind(kind: string | null | undefined): boolean {
  return kind !== 'HEADER';
}

export function resolveCreateAccountKind(input: {
  parentId?: string | null;
  accountKind?: AccountKindValue | null;
}): AccountKindValue {
  if (!input.parentId) return 'HEADER';
  return input.accountKind === 'HEADER' ? 'HEADER' : 'POSTING';
}

export function statementTypeFromAccountType(
  accountType?: string | null
): 'BALANCE_SHEET' | 'INCOME_STATEMENT' | undefined {
  const t = (accountType ?? '').trim().toLowerCase();
  if (!t) return undefined;
  if (t === 'revenue' || t === 'expense' || t === 'cogs' || t.includes('إيراد') || t.includes('مصروف')) {
    return 'INCOME_STATEMENT';
  }
  if (
    t === 'asset' ||
    t === 'liability' ||
    t === 'equity' ||
    t.includes('أصل') ||
    t.includes('التزام') ||
    t.includes('ملك')
  ) {
    return 'BALANCE_SHEET';
  }
  return undefined;
}
