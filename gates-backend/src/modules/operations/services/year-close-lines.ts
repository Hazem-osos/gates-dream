import { roundTo4 } from '../../../shared/utils/decimal-round';
import { classifyAccount } from '../../accounting/services/financial-report.util';

export type YearCloseSourceRow = {
  accountId: string;
  code: string;
  accountType: string | null;
  statementType: string | null;
  debitSum: number;
  creditSum: number;
};

export function isIncomeStatementCloseAccount(row: {
  code: string;
  accountType: string | null;
  statementType: string | null;
}): boolean {
  if (row.statementType === 'INCOME_STATEMENT') return true;
  const cls = classifyAccount(row.code, row.accountType);
  return cls === 'REVENUE' || cls === 'COGS' || cls === 'EXPENSE';
}

/**
 * Reverse every income-statement account to zero, then park the difference
 * on the profit-and-loss account so the closing entry stays balanced.
 */
export function buildYearCloseLines(
  rows: YearCloseSourceRow[],
  retainedEarningsAccountId: string
): {
  lines: Array<{ accountId: string; debit: number; credit: number }>;
  netToRetained: number;
} {
  const lines: Array<{ accountId: string; debit: number; credit: number }> = [];
  let netToRetained = 0;

  for (const row of rows) {
    if (row.accountId === retainedEarningsAccountId) continue;
    if (!isIncomeStatementCloseAccount(row)) continue;

    const netDebit = roundTo4(row.debitSum - row.creditSum);
    if (netDebit === 0) continue;

    if (netDebit > 0) {
      lines.push({ accountId: row.accountId, debit: 0, credit: netDebit });
      netToRetained = roundTo4(netToRetained - netDebit);
    } else {
      const amount = roundTo4(-netDebit);
      lines.push({ accountId: row.accountId, debit: amount, credit: 0 });
      netToRetained = roundTo4(netToRetained + amount);
    }
  }

  if (netToRetained > 0) {
    lines.push({
      accountId: retainedEarningsAccountId,
      debit: 0,
      credit: netToRetained,
    });
  } else if (netToRetained < 0) {
    lines.push({
      accountId: retainedEarningsAccountId,
      debit: roundTo4(-netToRetained),
      credit: 0,
    });
  }

  return { lines, netToRetained };
}
