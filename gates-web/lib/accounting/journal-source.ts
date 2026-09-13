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

export function journalSourceHref(
  sourceKind: JournalSourceType,
  sourceId?: string | null
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
      return `/accounting/operations/treasury/cash-payment?id=${q}`;
    case 'RECEIPT_VOUCHER':
      return `/accounting/operations/treasury/cash-receipt?id=${q}`;
    case 'STOCK_TRANSACTION':
      return `/inventory/operations/adjustment?id=${q}`;
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
