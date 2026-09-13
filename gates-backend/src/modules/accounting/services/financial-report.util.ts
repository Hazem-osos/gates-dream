import { roundTo4, amountsEqualAt4 } from '../../../shared/utils/decimal-round';

export type AccountClass =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COGS'
  | 'EXPENSE'
  | 'OTHER';

export function classifyAccount(code: string, accountType: string | null | undefined): AccountClass {
  const normalized = (accountType ?? '').toLowerCase();
  const c = code.trim();
  if (c.startsWith('51')) return 'COGS';
  if (c.startsWith('52') || c.startsWith('53')) return 'EXPENSE';
  if (c.startsWith('61') || c.startsWith('62')) return 'EXPENSE';
  if (c.startsWith('4') || normalized === 'revenue') return 'REVENUE';
  if (c.startsWith('1') || normalized === 'asset') return 'ASSET';
  if (c.startsWith('2') || normalized === 'liability') return 'LIABILITY';
  if (c.startsWith('3') || normalized === 'equity') return 'EQUITY';
  if (normalized === 'expense') return 'EXPENSE';
  if (normalized === 'cogs') return 'COGS';
  return 'OTHER';
}

/** Split signed net balance into trial-balance debit/credit columns. */
export function splitTrialBalanceColumns(netBalance: number): {
  endingDebit: number;
  endingCredit: number;
} {
  const net = roundTo4(netBalance);
  if (net >= 0) {
    return { endingDebit: net, endingCredit: 0 };
  }
  return { endingDebit: 0, endingCredit: roundTo4(-net) };
}

export function verifyTrialBalanceBalanced(
  rows: Array<{ endingDebit: number; endingCredit: number }>
): { balanced: boolean; totalEndingDebit: number; totalEndingCredit: number } {
  const totalEndingDebit = roundTo4(rows.reduce((s, r) => s + r.endingDebit, 0));
  const totalEndingCredit = roundTo4(rows.reduce((s, r) => s + r.endingCredit, 0));
  return {
    balanced: amountsEqualAt4(totalEndingDebit, totalEndingCredit),
    totalEndingDebit,
    totalEndingCredit,
  };
}

export function accountTreeLevel(code: string, maxLevel?: number): boolean {
  if (!maxLevel || maxLevel <= 0) return true;
  const segments = code.split(/[-.]/).filter(Boolean);
  if (segments.length > 1) return segments.length <= maxLevel;
  return code.length <= maxLevel * 2;
}
