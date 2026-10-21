import type { TransactionDocumentType } from '@/lib/transaction-settings/types';

export type MasterArchiveEntityType =
  | 'ITEM'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'DELEGATE'
  | 'DRIVER'
  | 'DISTRIBUTOR';

export type ArchiveEntityTarget = {
  entityType: string;
  entityId: string;
};

const TRANSACTION_ARCHIVE_ENTITY: Partial<Record<TransactionDocumentType, string>> = {
  SALES_INVOICE: 'INVOICE',
  PURCHASE_INVOICE: 'INVOICE',
  SALES_RETURN: 'INVOICE',
  PURCHASE_RETURN: 'INVOICE',
  PAYMENT_VOUCHER: 'TREASURY_VOUCHER',
  RECEIPT_VOUCHER: 'TREASURY_VOUCHER',
  PAYMENT_ORDER: 'TREASURY_VOUCHER',
  RECEIPT_ORDER: 'TREASURY_VOUCHER',
  TEMPORARY_RECEIPT: 'TREASURY_VOUCHER',
  CHEQUE_RECEIPT: 'CHEQUE',
  CHEQUE_PAYMENT: 'CHEQUE',
  JOURNAL_ENTRY: 'JOURNAL_ENTRY',
  OPENING_BALANCE: 'JOURNAL_ENTRY',
  SECURITIES_RECEIPT: 'TREASURY_VOUCHER',
  SECURITIES_PAYMENT: 'TREASURY_VOUCHER',
  OPENING_SECURITIES_RECEIPT: 'TREASURY_VOUCHER',
  OPENING_SECURITIES_PAYMENT: 'TREASURY_VOUCHER',
  BANK_DEBIT_ADVICE: 'JOURNAL_ENTRY',
  BANK_CREDIT_ADVICE: 'JOURNAL_ENTRY',
  STOCK_ISSUE: 'STOCK_ISSUE',
  STOCK_RECEIPT: 'STOCK_RECEIPT',
  STOCK_TRANSFER: 'STOCK_TRANSFER',
  STOCK_STOCKTAKING: 'STOCK_STOCKTAKING',
  STOCK_ASSEMBLY: 'STOCK_ASSEMBLY',
  STOCK_DISASSEMBLY: 'STOCK_DISASSEMBLY',
  STOCK_OTHER_ADJUSTMENT: 'STOCK_OTHER_ADJUSTMENT',
  OPENING_STOCK: 'OPENING_STOCK',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  PRICE_QUOTE: 'PRICE_QUOTE',
  SALES_ORDER: 'SALES_ORDER',
  MANUFACTURING_ORDER: 'MANUFACTURING_ORDER',
  MANUFACTURING_WORK_ORDER: 'MANUFACTURING_WORK_ORDER',
};

export function archiveEntityForTransactionDocument(
  documentType: TransactionDocumentType | undefined
): string | undefined {
  if (!documentType) return undefined;
  return TRANSACTION_ARCHIVE_ENTITY[documentType];
}

export function resolveArchiveTarget(input: {
  documentId?: string | null;
  transactionSettingsDocumentType?: TransactionDocumentType;
  archiveTarget?: ArchiveEntityTarget | null;
}): ArchiveEntityTarget | null {
  if (input.archiveTarget?.entityId?.trim()) {
    return {
      entityType: input.archiveTarget.entityType,
      entityId: input.archiveTarget.entityId.trim(),
    };
  }
  const id = input.documentId?.trim();
  const entityType = archiveEntityForTransactionDocument(input.transactionSettingsDocumentType);
  if (!id || !entityType) return null;
  return { entityType, entityId: id };
}

export function masterArchiveTarget(
  entityType: MasterArchiveEntityType,
  entityId: string | null | undefined
): ArchiveEntityTarget | null {
  const id = entityId?.trim();
  if (!id) return null;
  return { entityType, entityId: id };
}
