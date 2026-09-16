export const GL_ACCOUNT_TYPES = [
  { value: 'asset', label: 'أصول', statementType: 'BALANCE_SHEET' as const },
  { value: 'liability', label: 'التزامات', statementType: 'BALANCE_SHEET' as const },
  { value: 'equity', label: 'حقوق ملكية', statementType: 'BALANCE_SHEET' as const },
  { value: 'revenue', label: 'إيرادات', statementType: 'INCOME_STATEMENT' as const },
  { value: 'expense', label: 'مصروفات', statementType: 'INCOME_STATEMENT' as const },
] as const;

/** الأنواع الظاهرة في الفورم — حقوق الملكية ملغاة كتصنيف مستقل وتدخل تحت الالتزامات. */
export const GL_ACCOUNT_TYPE_OPTIONS = GL_ACCOUNT_TYPES.filter((row) => row.value !== 'equity');

export type GlAccountType = (typeof GL_ACCOUNT_TYPES)[number]['value'];
export type StatementType = 'BALANCE_SHEET' | 'INCOME_STATEMENT';

export function normalizeGlAccountType(value?: string | null): GlAccountType | '' {
  const t = (value ?? '').trim().toLowerCase();
  if (t === 'cogs' || t === 'تكلفة المبيعات') return 'expense';
  if (t === 'equity') return 'liability';
  if ((GL_ACCOUNT_TYPES as readonly { value: string }[]).some((row) => row.value === t)) {
    return t as GlAccountType;
  }
  if (t.includes('إيراد')) return 'revenue';
  if (t.includes('مصروف')) return 'expense';
  if (t.includes('ملك')) return 'liability';
  if (t.includes('التزام') || t.includes('خصوم')) return 'liability';
  if (t.includes('أصل')) return 'asset';
  return '';
}

export function statementTypeFromAccountType(
  accountType?: string | null
): StatementType | undefined {
  const normalized = normalizeGlAccountType(accountType);
  const hit = GL_ACCOUNT_TYPES.find((row) => row.value === normalized);
  return hit?.statementType;
}

export function applyAccountTypeDefaults(
  accountType: string,
  current?: { statementType?: StatementType; accountSide?: 'مدين' | 'دائن' | '' | null }
) {
  const normalized = normalizeGlAccountType(accountType);
  const hit = GL_ACCOUNT_TYPES.find((row) => row.value === normalized);
  const statementType = hit?.statementType ?? current?.statementType ?? 'BALANCE_SHEET';
  const suggestedSide: 'مدين' | 'دائن' | '' =
    normalized === 'liability' || normalized === 'equity' || normalized === 'revenue'
      ? 'دائن'
      : normalized
        ? 'مدين'
        : '';
  return {
    accountType: normalized,
    statementType,
    accountSide: current?.accountSide || suggestedSide,
    accountNature: (current?.accountSide || suggestedSide) === 'دائن' ? 'CREDIT' as const : 'DEBIT' as const,
  };
}
