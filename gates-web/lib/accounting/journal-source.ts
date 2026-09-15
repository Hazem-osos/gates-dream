export const JOURNAL_SOURCE_TYPES = [
  'MANUAL',
  'RECURRING_TEMPLATE',
  'SALES_INVOICE',
  'SALES_RETURN',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN',
  'PAYMENT_VOUCHER',
  'RECEIPT_VOUCHER',
  'STOCK_TRANSACTION',
  'DEPRECIATION',
  'CHEQUE_ENDORSEMENT',
  'CLOSING_ENTRY',
] as const;

export type JournalSourceType = (typeof JOURNAL_SOURCE_TYPES)[number];

const AUTO_GL_TO_KIND: Record<string, JournalSourceType> = {
  SI: 'SALES_INVOICE',
  PI: 'PURCHASE_INVOICE',
  SR: 'SALES_RETURN',
  PR: 'PURCHASE_RETURN',
  CR: 'RECEIPT_VOUCHER',
  CP: 'PAYMENT_VOUCHER',
  CEP: 'PAYMENT_VOUCHER',
  CKC: 'CHEQUE_ENDORSEMENT',
  CKB: 'CHEQUE_ENDORSEMENT',
  CKE: 'CHEQUE_ENDORSEMENT',
  GI: 'STOCK_TRANSACTION',
  GR: 'STOCK_TRANSACTION',
  TRF: 'STOCK_TRANSACTION',
  STK: 'STOCK_TRANSACTION',
  ADJ: 'STOCK_TRANSACTION',
  OB: 'STOCK_TRANSACTION',
  OPEN: 'STOCK_TRANSACTION',
  ASM: 'STOCK_TRANSACTION',
  DSM: 'STOCK_TRANSACTION',
};

const KIND_SET = new Set<string>(JOURNAL_SOURCE_TYPES);

export function resolveJournalSourceKind(
  sourceType?: string | null,
  sourceKind?: string | null
): JournalSourceType {
  if (sourceKind && KIND_SET.has(sourceKind)) return sourceKind as JournalSourceType;
  if (sourceType && KIND_SET.has(sourceType)) return sourceType as JournalSourceType;
  if (sourceType && AUTO_GL_TO_KIND[sourceType]) return AUTO_GL_TO_KIND[sourceType];
  return 'MANUAL';
}

export function hrefForCashTransaction(row: {
  id: string;
  documentRole?: string | null;
  transactionKind?: string | null;
  safeId?: string | null;
  bankAccountId?: string | null;
}): string {
  const q = encodeURIComponent(row.id);
  const isOrder = (row.documentRole || '').toUpperCase() === 'ORDER';
  const isReceipt = (row.transactionKind || '').toUpperCase() === 'RECEIPT';
  const isBank = Boolean(row.bankAccountId);

  if (isOrder) {
    return isReceipt
      ? `/accounting/orders/receipt-order?id=${q}`
      : `/accounting/orders/payment-order?id=${q}`;
  }
  if (isBank) {
    return isReceipt
      ? `/accounting/operations/banks/bank-addition?id=${q}`
      : `/accounting/operations/banks/bank-discount?id=${q}`;
  }
  return isReceipt
    ? `/accounting/operations/treasury/receipt-voucher?id=${q}`
    : `/accounting/operations/treasury/payment-voucher?id=${q}`;
}

function stockSourceHref(sourceType: string | null | undefined, sourceId: string): string {
  const q = encodeURIComponent(sourceId);
  switch ((sourceType || '').toUpperCase()) {
    case 'GI':
      return `/inventory/operations/issue?id=${q}`;
    case 'GR':
      return `/inventory/operations/receipt?id=${q}`;
    case 'TRF':
    case 'STK':
      return `/inventory/operations/transfer?id=${q}`;
    case 'OB':
    case 'OPEN':
      return `/inventory/operations/opening-stock?id=${q}`;
    case 'ASM':
      return `/inventory/operations/assembly?id=${q}`;
    case 'DSM':
      return `/inventory/operations/disassembly?id=${q}`;
    default:
      return `/inventory/operations/adjustment?id=${q}`;
  }
}

export function journalSourceHref(
  sourceKind: JournalSourceType,
  sourceId?: string | null,
  sourceType?: string | null
): string | null {
  if (!sourceId) return null;
  const q = encodeURIComponent(sourceId);
  switch (sourceKind) {
    case 'SALES_INVOICE':
      return `/inventory/operations/sales-invoice?invoiceId=${q}`;
    case 'SALES_RETURN':
      return `/inventory/operations/sales-returns?invoiceId=${q}`;
    case 'PURCHASE_INVOICE':
      return `/inventory/operations/final-purchase-invoice?invoiceId=${q}`;
    case 'PURCHASE_RETURN':
      return `/inventory/operations/purchase-returns?invoiceId=${q}`;
    case 'PAYMENT_VOUCHER':
    case 'RECEIPT_VOUCHER':
      return `/accounting/operations/treasury/open?id=${q}`;
    case 'STOCK_TRANSACTION':
      return stockSourceHref(sourceType, sourceId);
    case 'CHEQUE_ENDORSEMENT':
      return `/accounting/operations/securities`;
    default:
      return null;
  }
}

export const RECURRING_FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: 'أسبوعي',
  MONTHLY: 'شهري',
  QUARTERLY: 'ربع سنوي',
  YEARLY: 'سنوي',
};
