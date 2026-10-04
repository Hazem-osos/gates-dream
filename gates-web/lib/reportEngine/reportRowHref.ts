import {
  journalDocumentHref,
  journalSourceHref,
  movementDocumentHref,
  resolveJournalSourceKind,
} from '@/lib/accounting/journal-source';

function text(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function invoiceHref(kind: string | null, id: string): string | null {
  const q = encodeURIComponent(id);
  const value = (kind ?? '').toUpperCase();
  if (value.includes('SALE_RETURN') || value === 'SR') {
    return `/inventory/operations/sales-returns?invoiceId=${q}`;
  }
  if (value.includes('PURCHASE_RETURN') || value === 'PR') {
    return `/inventory/operations/purchase-returns?invoiceId=${q}`;
  }
  if (value.includes('PURCHASE') || value === 'PI') {
    return `/inventory/operations/final-purchase-invoice?invoiceId=${q}`;
  }
  if (value.includes('SALE') || value === 'SI' || value === 'SALES') {
    return `/inventory/operations/sales-invoice?invoiceId=${q}`;
  }
  return null;
}

function hrefFromReport(registryPath: string, row: Record<string, unknown>): string | null {
  const id = text(row, 'id');
  const invoiceId = text(row, 'invoiceId') ?? id;
  const itemId = text(row, 'itemId');
  const transferId = text(row, 'transferId') ?? id;
  const path = registryPath.toLowerCase();

  if (invoiceId && /sales-returns/.test(path) && !/sales-and-returns/.test(path)) {
    return `/inventory/operations/sales-returns?invoiceId=${encodeURIComponent(invoiceId)}`;
  }
  if (invoiceId && /purchase-returns/.test(path)) {
    return `/inventory/operations/purchase-returns?invoiceId=${encodeURIComponent(invoiceId)}`;
  }
  if (invoiceId && /purchase-reports|purchases/.test(path)) {
    return `/inventory/operations/final-purchase-invoice?invoiceId=${encodeURIComponent(invoiceId)}`;
  }
  if (invoiceId && /sales-reports|invoices-profit|detailed-invoice|analytical-invoices/.test(path)) {
    return `/inventory/operations/sales-invoice?invoiceId=${encodeURIComponent(invoiceId)}`;
  }
  if (transferId && /stock-transfer/.test(path)) {
    return `/inventory/operations/transfer?id=${encodeURIComponent(transferId)}`;
  }
  if (itemId && /item|inventory-reports|price-list|expiry|reorder|valuation/.test(path)) {
    return `/inventory/creations/item-card?id=${encodeURIComponent(itemId)}`;
  }
  return null;
}

const JOURNAL_NUMBER_COLUMN_IDS = new Set([
  'voucherNumber',
  'legacyGlNum',
  'glNum',
  'GlNum',
  'entryNumber',
]);

export function isJournalNumberColumn(column: { id: string; label: string }): boolean {
  return JOURNAL_NUMBER_COLUMN_IDS.has(column.id) || column.label.trim() === 'رقم القيد';
}

export function isAccountCodeColumn(column: { id: string }): boolean {
  return column.id === 'code';
}

const LEDGER_QUERY_KEYS = ['fromDate', 'toDate', 'costCenterId', 'currencyId', 'branchId'] as const;

export function isPaperNumberColumn(column: { id: string }): boolean {
  return column.id === 'paperNumber';
}

export function isInvoiceNumberColumn(column: { id: string; label: string }): boolean {
  const label = column.label.trim();
  return column.id === 'invoiceNumber' || label === 'رقم الفاتورة' || label === 'الفاتورة';
}

const OPERATION_NUMBER_IDS = new Set([
  'invoiceNumber',
  'sourceNumber',
  'documentNumber',
  'paperNumber',
  'quotationNumber',
  'purchaseOrderNumber',
  'originalInvoiceNumber',
  'voucherNumber',
  'legacyGlNum',
  'glNum',
  'GlNum',
  'entryNumber',
  'sourceLabel',
]);

const OPERATION_NUMBER_LABELS = new Set([
  'رقم الفاتورة',
  'رقم العملية',
  'الفاتورة',
  'رقمه',
  'الرقم',
  'المستند',
  'رقم الورقة',
  'رقم القيد',
  'رقم المصدر',
  'رقم عرض السعر',
  'رقم أمر الشراء',
  'فاتورة المبيعات الأصلية',
  'فاتورة المشتريات الأصلية',
  'رقم الفاتورة والمصدر',
  'المسلسل',
]);

export function isOperationNumberColumn(column: { id: string; label: string }): boolean {
  return OPERATION_NUMBER_IDS.has(column.id) || OPERATION_NUMBER_LABELS.has(column.label.trim());
}

function sourceDocumentHref(row: Record<string, unknown>): string | null {
  const preview = text(row, 'sourcePreviewPath');
  if (preview?.startsWith('/')) return preview;
  const sourceId = text(row, 'sourceDocumentId') ?? text(row, 'sourceId');
  const movement = movementDocumentHref(text(row, 'sourceType'), sourceId);
  if (movement) return movement;
  return journalDocumentHref({
    sourceType: text(row, 'sourceType'),
    sourceKind: text(row, 'sourceKind'),
    sourceId,
    entryType: text(row, 'entryType'),
    voucherFund: text(row, 'voucherFund'),
  });
}

/** Opens the operation behind a document-number cell. Amounts and item codes stay plain. */
export function operationNumberHref(
  column: { id: string; label: string },
  row: Record<string, unknown>,
  registryPath = ''
): string | null {
  if (!isOperationNumberColumn(column)) return null;
  const shown = text(row, column.id);
  if (!shown || shown === '—' || shown === '-') return null;

  const id = column.id;
  const label = column.label.trim();
  const sourceColumn =
    id === 'sourceNumber' || label === 'رقمه' || label === 'رقم المصدر' || label === 'المستند';
  if (sourceColumn) return sourceDocumentHref(row);

  if (id === 'quotationNumber' || label === 'رقم عرض السعر') {
    const quoteId = text(row, 'quotationId') ?? text(row, 'quoteId');
    if (quoteId) return `/inventory/operations/price-quote?quoteId=${encodeURIComponent(quoteId)}`;
    return sourceDocumentHref(row);
  }

  if (id === 'purchaseOrderNumber' || label === 'رقم أمر الشراء') {
    const orderId = text(row, 'purchaseOrderId');
    if (!orderId) return null;
    return `/inventory/operations/purchase-order?orderId=${encodeURIComponent(orderId)}`;
  }

  if (
    id === 'originalInvoiceNumber' ||
    label === 'فاتورة المبيعات الأصلية' ||
    label === 'فاتورة المشتريات الأصلية'
  ) {
    const originalId = text(row, 'originalInvoiceId');
    if (!originalId) return null;
    const purchase = label === 'فاتورة المشتريات الأصلية' || text(row, 'invoiceKind') === 'PURCHASE_RETURN';
    const q = encodeURIComponent(originalId);
    return purchase
      ? `/inventory/operations/final-purchase-invoice?invoiceId=${q}`
      : `/inventory/operations/sales-invoice?invoiceId=${q}`;
  }

  if (id === 'paperNumber' || label === 'رقم الورقة') return financialPaperHref(row);

  if (
    id === 'invoiceNumber' ||
    id === 'sourceLabel' ||
    label === 'رقم الفاتورة' ||
    label === 'رقم العملية' ||
    label === 'الفاتورة' ||
    label === 'رقم الفاتورة والمصدر'
  ) {
    const preview = text(row, 'invoicePreviewPath');
    if (preview?.startsWith('/')) return preview;
    return invoiceNumberHref(row, registryPath);
  }

  if (id === 'serial' || label === 'المسلسل') {
    const transferId = text(row, 'transferId') ?? text(row, 'id');
    if (transferId) return `/inventory/operations/transfer?id=${encodeURIComponent(transferId)}`;
  }

  if (isJournalNumberColumn(column)) {
    return journalEntryHref(row) ?? financialPaperHref(row);
  }

  const source = sourceDocumentHref(row);
  if (source) return source;
  return journalEntryHref(row);
}

/** Opens the invoice document from its number. Ignores any linked journal entry. */
export function invoiceNumberHref(
  row: Record<string, unknown>,
  registryPath = ''
): string | null {
  const id = text(row, 'invoiceId') ?? text(row, 'id');
  if (!id) return null;
  const kind = text(row, 'invoiceKind') ?? text(row, 'invoiceType');
  const fromKind = invoiceHref(kind, id);
  if (fromKind) return fromKind;
  const path = registryPath.toLowerCase();
  const q = encodeURIComponent(id);
  if (/sales-returns/.test(path) && !/sales-and-returns/.test(path)) {
    return `/inventory/operations/sales-returns?invoiceId=${q}`;
  }
  if (/purchase-returns/.test(path)) {
    return `/inventory/operations/purchase-returns?invoiceId=${q}`;
  }
  if (/purchase-reports|purchases/.test(path)) {
    return `/inventory/operations/final-purchase-invoice?invoiceId=${q}`;
  }
  if (/sales-reports|invoices-profit|detailed-invoice|analytical-invoices|pos/.test(path)) {
    return `/inventory/operations/sales-invoice?invoiceId=${q}`;
  }
  return null;
}

/** Opens the original receipt or payment paper from تقرير الأوراق المالية. */
export function financialPaperHref(row: Record<string, unknown>): string | null {
  const id = text(row, 'id');
  const kind = text(row, 'paperType');
  if (!id || !kind) return null;
  const q = encodeURIComponent(id);
  if (kind === 'شيك قبض') return `/accounting/cheques/incoming?id=${q}`;
  if (kind === 'شيك صرف') return `/accounting/cheques/outgoing?id=${q}`;
  if (kind === 'ورقة قبض') return `/accounting/operations/securities/receipt?id=${q}`;
  if (kind === 'ورقة دفع') return `/accounting/operations/securities/payment?id=${q}`;
  return null;
}

const MOVEMENT_QUERY_KEYS = ['fromDate', 'toDate'] as const;

/** Opens حركة الصنف for an inventory-count row, keeping the warehouse and period. */
export function itemMovementHref(
  row: Record<string, unknown>,
  query: Record<string, string> = {}
): string | null {
  const itemId = text(row, 'itemId');
  if (!itemId) return null;
  const params = new URLSearchParams();
  params.set('itemId', itemId);
  const warehouseId = text(row, 'warehouseId') || query.warehouseId?.trim() || '';
  if (warehouseId) params.set('warehouseId', warehouseId);
  for (const key of MOVEMENT_QUERY_KEYS) {
    const value = query[key]?.trim();
    if (value) params.set(key, value);
  }
  return `/inventory/reports/item-movement-reports?${params.toString()}`;
}

export function isItemNameColumn(column: { id: string }): boolean {
  return column.id === 'itemName';
}

export function isItemCodeColumn(column: { id: string }): boolean {
  return column.id === 'itemSerial' || column.id === 'itemCode';
}

/** Opens دفتر الأستاذ for the account on a trial-balance row, keeping the same period. */
export function accountLedgerHref(
  row: Record<string, unknown>,
  query: Record<string, string> = {}
): string | null {
  const accountId = text(row, 'accountId');
  if (!accountId || accountId === 'current-period-pnl' || accountId === 'net-income') return null;
  const params = new URLSearchParams();
  params.set('accountId', accountId);
  for (const key of LEDGER_QUERY_KEYS) {
    const value = query[key]?.trim();
    if (value) params.set(key, value);
  }
  return `/accounting/account-reports/books/daftar-ostaz?${params.toString()}`;
}

/** Opens the journal entry for a report row. Never the source document. */
export function journalEntryHref(row: Record<string, unknown>): string | null {
  const id = text(row, 'journalEntryId') ?? text(row, 'costJournalEntryId');
  if (!id) return null;
  return `/accounting/operations/journal-entry?id=${encodeURIComponent(id)}`;
}

/** Opens the document behind a report row: source voucher, journal entry, invoice, item, or account. */
export function reportRowHref(
  row: Record<string, unknown>,
  registryPath = ''
): string | null {
  const direct =
    text(row, 'invoicePreviewPath') ?? text(row, 'sourcePreviewPath') ?? text(row, 'href');
  if (direct?.startsWith('/')) return direct;

  const sourceId = text(row, 'sourceId') ?? text(row, 'sourceDocumentId');
  const sourceType = text(row, 'sourceType');
  const sourceKind = text(row, 'sourceKind');
  if (sourceId && (sourceType || sourceKind)) {
    const kind = resolveJournalSourceKind(sourceType, sourceKind);
    const fund = text(row, 'voucherFund');
    const href = journalSourceHref(
      kind,
      sourceId,
      sourceType,
      fund === 'bank' || fund === 'cash' ? fund : null
    );
    if (href) return href;
  }

  const journalEntryId = text(row, 'journalEntryId') ?? text(row, 'costJournalEntryId');
  if (journalEntryId) {
    return `/accounting/operations/journal-entry?id=${encodeURIComponent(journalEntryId)}`;
  }

  const invoiceId = text(row, 'invoiceId');
  const invoiceKind = text(row, 'invoiceKind') ?? text(row, 'invoiceType');
  if (invoiceId) {
    const href = invoiceHref(invoiceKind, invoiceId);
    if (href) return href;
  }

  const ownId = text(row, 'id');
  const looksLikeInvoice = Boolean(text(row, 'invoiceNumber') || invoiceKind);
  if (ownId && looksLikeInvoice) {
    const href = invoiceHref(invoiceKind, ownId);
    if (href) return href;
  }

  const transferId = text(row, 'transferId');
  if (transferId) return `/inventory/operations/transfer?id=${encodeURIComponent(transferId)}`;

  const fromRegistry = hrefFromReport(registryPath, row);
  if (fromRegistry) return fromRegistry;

  const itemId = text(row, 'itemId');
  if (itemId) return `/inventory/creations/item-card?id=${encodeURIComponent(itemId)}`;

  const customerId = text(row, 'customerId');
  if (customerId && !looksLikeInvoice) {
    return `/accounting/cards/customer?id=${encodeURIComponent(customerId)}`;
  }
  const supplierId = text(row, 'supplierId');
  if (supplierId && !looksLikeInvoice) {
    return `/accounting/cards/supplier?id=${encodeURIComponent(supplierId)}`;
  }

  const accountId = text(row, 'accountId');
  if (accountId && accountId !== 'current-period-pnl' && accountId !== 'net-income') {
    return `/accounting/account-reports/books/daftar-ostaz?accountId=${encodeURIComponent(accountId)}`;
  }

  return null;
}
