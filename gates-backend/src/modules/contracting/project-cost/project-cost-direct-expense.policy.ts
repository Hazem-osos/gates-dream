import type { CashTransaction, CashTransactionLine, Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient | { contractingCertificateAllocation: Prisma.ContractingCertificateAllocationDelegate; paymentAllocation: Prisma.PaymentAllocationDelegate };

/**
 * Treasury lines that qualify as project DIRECT_EXPENSE (P2-1.1):
 *
 * - Cash transaction is POSTED and not cancelled
 * - Line is DEBIT on an expense/COGS-class account
 * - Line cost center maps to a contracting project (via project.costCenterId)
 * - Line is NOT tied to purchase/AP invoice settlement
 * - Transaction is NOT a contracting certificate settlement (sub/client invoice payment)
 * - Transaction is NOT an open-item payment allocation to trade invoices
 *
 * Paying subcontract **liability** after the SubcontractInvoice already created
 * SUBCONTRACTOR actual cost must NOT create a second project expense.
 */
export async function isCashTransactionSettlementExcludedFromDirectExpense(
  db: Db,
  tx: Pick<CashTransaction, 'id' | 'invoiceId' | 'subcontractorId' | 'supplierId'>
): Promise<boolean> {
  if (tx.invoiceId) return true;
  if (tx.subcontractorId) return true;

  const certCount = await db.contractingCertificateAllocation.count({
    where: { cashTransactionId: tx.id },
  });
  if (certCount > 0) return true;

  const payAllocCount = await db.paymentAllocation.count({
    where: { cashTransactionId: tx.id },
  });
  if (payAllocCount > 0) return true;

  return false;
}

export function isCashLineEligibleDirectExpenseDebit(
  line: Pick<CashTransactionLine, 'entrySide' | 'isTiedToInvoice' | 'invoiceId'>,
  isExpenseAccount: boolean
): boolean {
  if (line.entrySide !== 'DEBIT') return false;
  if (!isExpenseAccount) return false;
  if (line.isTiedToInvoice) return false;
  if (line.invoiceId) return false;
  return true;
}
