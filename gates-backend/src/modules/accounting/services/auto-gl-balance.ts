import { UnbalancedJournalEntryException } from '../../../shared/errors/unbalanced-journal-entry.error';
import { amountsEqualAt4, roundTo4 } from '../../../shared/utils/decimal-round';
import { AUTO_GL_SOURCE } from '../types/auto-gl-posting.types';

const LONG_TO_SHORT: Record<string, string> = {
  SALES_INVOICE: AUTO_GL_SOURCE.SALES_INVOICE,
  PURCHASE_INVOICE: AUTO_GL_SOURCE.PURCHASE_INVOICE,
  SALE_RETURN: AUTO_GL_SOURCE.SALE_RETURN,
  SALES_RETURN: AUTO_GL_SOURCE.SALE_RETURN,
  PURCHASE_RETURN: AUTO_GL_SOURCE.PURCHASE_RETURN,
  TREASURY_RECEIPT: AUTO_GL_SOURCE.TREASURY_RECEIPT,
  TREASURY_PAYMENT: AUTO_GL_SOURCE.TREASURY_PAYMENT,
  CONTRACTOR_EXTRACT_PAYMENT: AUTO_GL_SOURCE.CONTRACTOR_EXTRACT_PAYMENT,
  CHECK_COLLECT: AUTO_GL_SOURCE.CHECK_COLLECT,
  CHECK_BOUNCE: AUTO_GL_SOURCE.CHECK_BOUNCE,
  CHECK_ENDORSE: AUTO_GL_SOURCE.CHECK_ENDORSE,
};

export function normalizeAutoGlSourceType(sourceType: string): string {
  return LONG_TO_SHORT[sourceType] ?? sourceType;
}

function lineBase(line: {
  debit?: number;
  credit?: number;
  debitBase?: number;
  creditBase?: number;
  exchangeRate?: number | null;
}): { debitBase: number; creditBase: number } {
  if (line.debitBase != null || line.creditBase != null) {
    return {
      debitBase: roundTo4(Number(line.debitBase || 0)),
      creditBase: roundTo4(Number(line.creditBase || 0)),
    };
  }
  const rate = Number(line.exchangeRate);
  const fx = Number.isFinite(rate) && rate > 0 ? rate : 1;
  return {
    debitBase: roundTo4(Number(line.debit || 0) * fx),
    creditBase: roundTo4(Number(line.credit || 0) * fx),
  };
}

/** Balance is in base currency so mixed exchange rates still post. */
export function assertJournalBalanced(
  lines: Array<{
    debit?: number;
    credit?: number;
    debitBase?: number;
    creditBase?: number;
    exchangeRate?: number | null;
  }>
): { totalDebit: number; totalCredit: number } {
  const totalDebit = roundTo4(lines.reduce((sum, line) => sum + lineBase(line).debitBase, 0));
  const totalCredit = roundTo4(lines.reduce((sum, line) => sum + lineBase(line).creditBase, 0));
  if (!amountsEqualAt4(totalDebit, totalCredit)) {
    throw new UnbalancedJournalEntryException(totalDebit.toFixed(4), totalCredit.toFixed(4));
  }
  return { totalDebit, totalCredit };
}
