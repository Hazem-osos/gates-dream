import { UnbalancedJournalEntryException } from '../../../shared/errors/unbalanced-journal-entry.error';
import { AUTO_GL_SOURCE, GL_BALANCE_EPSILON } from '../types/auto-gl-posting.types';

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

export function assertJournalBalanced(
  lines: Array<{ debit: number; credit: number }>,
  epsilon = GL_BALANCE_EPSILON
): { totalDebit: number; totalCredit: number } {
  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) >= epsilon) {
    throw new UnbalancedJournalEntryException(totalDebit.toFixed(4), totalCredit.toFixed(4));
  }
  return { totalDebit, totalCredit };
}
