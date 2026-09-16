export type CostCenterRule = 'required' | 'optional' | 'none';

export function costCenterRuleFromAccount(account?: {
  costCenterRequired?: string | null;
  requiresCostCenter?: boolean | null;
} | null): CostCenterRule {
  const raw = (account?.costCenterRequired ?? '').trim();
  if (raw === 'بدون' || raw.toUpperCase() === 'NONE') return 'none';
  if (raw === 'إجباري' || raw.toUpperCase() === 'REQUIRED' || account?.requiresCostCenter) {
    return 'required';
  }
  return 'optional';
}

export function costCenterRuleMessage(
  rule: CostCenterRule,
  accountCode?: string
): string | null {
  const who = accountCode ? ` للحساب ${accountCode}` : '';
  if (rule === 'required') return `مركز التكلفة إجباري${who}`;
  if (rule === 'none') return `الحساب${who} مربوط بدون مركز تكلفة — امسح المركز من السطر`;
  return null;
}
