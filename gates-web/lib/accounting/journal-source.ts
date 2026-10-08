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
  'SECURITIES_RECEIPT',
  'SECURITIES_PAYMENT',
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
  SECR: 'SECURITIES_RECEIPT',
  SECP: 'SECURITIES_PAYMENT',
  SECREN: 'SECURITIES_RECEIPT',
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
  if (sourceType && AUTO_GL_TO_KIND[sourceType]) return AUTO_GL_TO_KIND[sourceType];
  const sourcePrefix = String(sourceType ?? '').split('-')[0];
  if (sourcePrefix && AUTO_GL_TO_KIND[sourcePrefix]) return AUTO_GL_TO_KIND[sourcePrefix];
  if (sourceKind && KIND_SET.has(sourceKind) && sourceKind !== 'MANUAL') {
    return sourceKind as JournalSourceType;
  }
  if (sourceType && KIND_SET.has(sourceType)) return sourceType as JournalSourceType;
  if (sourceKind && KIND_SET.has(sourceKind)) return sourceKind as JournalSourceType;
  return 'MANUAL';
}

const JOURNAL_SOURCE_LABELS: Record<JournalSourceType, string> = {
  MANUAL: 'قيد يدوي',
  RECURRING_TEMPLATE: 'قيد دوري',
  SALES_INVOICE: 'فاتورة مبيعات',
  SALES_RETURN: 'مرتجع مبيعات',
  PURCHASE_INVOICE: 'فاتورة مشتريات',
  PURCHASE_RETURN: 'مرتجع مشتريات',
  PAYMENT_VOUCHER: 'سند صرف',
  RECEIPT_VOUCHER: 'سند قبض',
  STOCK_TRANSACTION: 'حركة مخزنية',
  DEPRECIATION: 'إهلاك',
  CHEQUE_ENDORSEMENT: 'تظهير شيك',
  CLOSING_ENTRY: 'قيد إقفال',
  SECURITIES_RECEIPT: 'ورقة قبض',
  SECURITIES_PAYMENT: 'ورقة دفع',
};

export type JournalSourceHint = {
  entryType?: string | null;
  voucherFund?: 'bank' | 'cash' | null;
};

export function journalSourceLabel(
  sourceType?: string | null,
  sourceKind?: string | null,
  hint?: JournalSourceHint | null
): string {
  const family = String(sourceType ?? '').trim().toUpperCase().split('-')[0];
  const entryType = String(hint?.entryType ?? '').trim().toUpperCase();
  if (family === 'OB' || family === 'OPEN' || entryType === 'OPENING_STOCK') return 'بضاعة أول المدة';
  if (entryType === 'OPENING_BALANCE') return 'قيد افتتاحي';
  if (family === 'KP01') return 'إشعار خصم بنكي';
  if (family === 'KR01') return 'إشعار إضافة بنكي';
  if (family === 'MO' || entryType.startsWith('PROD')) return 'أمر تصنيع';
  const kind = resolveJournalSourceKind(sourceType, sourceKind);
  if (hint?.voucherFund === 'bank' && kind === 'PAYMENT_VOUCHER') return 'إشعار خصم بنكي';
  if (hint?.voucherFund === 'bank' && kind === 'RECEIPT_VOUCHER') return 'إشعار إضافة بنكي';
  return JOURNAL_SOURCE_LABELS[kind];
}

export function journalSourceLabelFromRow(row: {
  sourceType?: unknown;
  sourceKind?: unknown;
  entryType?: unknown;
  voucherFund?: unknown;
}): string {
  const text = (value: unknown) => (typeof value === 'string' ? value : null);
  const fund = text(row.voucherFund);
  return journalSourceLabel(text(row.sourceType), text(row.sourceKind), {
    entryType: text(row.entryType),
    voucherFund: fund === 'bank' || fund === 'cash' ? fund : null,
  });
}

const JOURNAL_OWNED_KINDS = new Set<JournalSourceType>(['MANUAL', 'RECURRING_TEMPLATE']);

export function isSourcedJournalEntry(row: {
  sourceType?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  entryType?: string | null;
  isCyclic?: boolean | null;
  isRecurring?: boolean | null;
}): boolean {
  const kind = resolveJournalSourceKind(row.sourceType, row.sourceKind);
  if (kind === 'RECURRING_TEMPLATE') return false;
  if ((row.isCyclic || row.isRecurring) && JOURNAL_OWNED_KINDS.has(kind)) return false;
  if (!JOURNAL_OWNED_KINDS.has(kind)) return true;
  if (String(row.sourceId ?? '').trim()) return true;
  const sourceType = String(row.sourceType ?? '').trim();
  if (sourceType && sourceType !== 'MANUAL' && !JOURNAL_OWNED_KINDS.has(sourceType as JournalSourceType)) {
    return true;
  }
  const sourceFamily = String(row.sourceType ?? '').trim().toUpperCase().split('-')[0];
  const entryType = String(row.entryType ?? '').trim().toUpperCase();
  if (sourceFamily === 'MO' || entryType.startsWith('PROD')) return true;
  if (!entryType || entryType === 'MANUAL' || entryType === 'OPENING_BALANCE') return false;
  if (entryType === 'REVERSAL' || entryType === 'YEARCLOSE') return true;
  if (entryType.includes('COGS') || entryType.includes('RETURN')) return true;
  return entryType === 'SALE' || entryType === 'PURCHASE';
}

/** Daily journal voucher may mutate only true manual/recurring entries. */
export function isDailyJournalVoucherMutable(row: {
  sourceType?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  entryType?: string | null;
  isCyclic?: boolean | null;
  isRecurring?: boolean | null;
}): boolean {
  if (isSourcedJournalEntry(row)) return false;
  return String(row.entryType ?? '').trim().toUpperCase() !== 'OPENING_BALANCE';
}

export function journalDocumentHref(row: {
  sourceType?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  entryType?: string | null;
  voucherFund?: string | null;
}): string | null {
  const source = String(row.sourceType ?? '').trim().toUpperCase().split('-')[0];
  const entryType = String(row.entryType ?? '').trim().toUpperCase();
  if ((source === 'OB' || source === 'OPEN' || entryType === 'OPENING_STOCK') && row.sourceId) {
    return `/inventory/operations/opening-stock?id=${encodeURIComponent(row.sourceId)}`;
  }
  if (entryType === 'OPENING_BALANCE') {
    return '/accounting/operations/basic-operations/opening-balance';
  }
  if (source === 'MO' && row.sourceId) {
    return `/manufacturing/operations/operation?orderId=${encodeURIComponent(row.sourceId)}`;
  }
  const kind = resolveJournalSourceKind(row.sourceType, row.sourceKind);
  const fund = row.voucherFund === 'bank' || row.voucherFund === 'cash' ? row.voucherFund : null;
  return journalSourceHref(kind, row.sourceId, row.sourceType, fund);
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

export function hrefForCheque(row: {
  id: string;
  direction?: string | null;
}): string {
  const q = encodeURIComponent(row.id);
  const outward = (row.direction || '').toUpperCase() === 'OUTWARD';
  return outward
    ? `/accounting/cheques/outgoing?id=${q}`
    : `/accounting/cheques/incoming?id=${q}`;
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

/** Opens the stock or invoice document behind a movement row. */
export function movementDocumentHref(
  sourceType: string | null | undefined,
  sourceDocumentId: string | null | undefined
): string | null {
  const id = sourceDocumentId?.trim();
  if (!id) return null;
  const type = (sourceType || '')
    .toUpperCase()
    .replace(/-COGS$/, '')
    .replace(/-UNPOST$/, '')
    .replace(/-EDIT$/, '')
    .replace(/-CANCEL$/, '');
  const q = encodeURIComponent(id);
  switch (type) {
    case 'SI':
    case 'SALE':
      return `/inventory/operations/sales-invoice?invoiceId=${q}`;
    case 'SR':
    case 'SALE_RETURN':
      return `/inventory/operations/sales-returns?invoiceId=${q}`;
    case 'PI':
    case 'PURCHASE':
      return `/inventory/operations/final-purchase-invoice?invoiceId=${q}`;
    case 'PR':
    case 'PURCHASE_RETURN':
      return `/inventory/operations/purchase-returns?invoiceId=${q}`;
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
    case 'MO':
      return `/manufacturing/operations/operation?orderId=${q}`;
    default:
      return null;
  }
}

export function journalSourceHref(
  sourceKind: JournalSourceType,
  sourceId?: string | null,
  sourceType?: string | null,
  voucherFund?: 'bank' | 'cash' | null
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
      if (voucherFund === 'bank') return `/accounting/operations/banks/bank-discount?id=${q}`;
      return `/accounting/operations/treasury/open?id=${q}`;
    case 'RECEIPT_VOUCHER':
      if (voucherFund === 'bank') return `/accounting/operations/banks/bank-addition?id=${q}`;
      return `/accounting/operations/treasury/open?id=${q}`;
    case 'STOCK_TRANSACTION':
      return stockSourceHref(sourceType, sourceId);
    case 'CHEQUE_ENDORSEMENT':
      return `/accounting/operations/securities`;
    case 'SECURITIES_RECEIPT':
      return `/accounting/operations/securities/reciept?id=${q}`;
    case 'SECURITIES_PAYMENT':
      return `/accounting/operations/securities/payment?id=${q}`;
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
