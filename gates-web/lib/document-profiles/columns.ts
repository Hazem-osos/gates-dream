import {
  INVOICE_LINE_COLUMN_DEFS,
  SALES_INVOICE_STORAGE_DEFAULT,
  type InvoiceLineColumnId,
} from '@/lib/invoices/invoiceLineColumns';
import type { DocumentProfileColumnKey } from './types';

const GROUP_TO_COLUMNS: Record<DocumentProfileColumnKey, InvoiceLineColumnId[]> = {
  colorAndSize: ['color', 'size'],
  batchAndExpiry: ['batchAndExpiry'],
  withholdingTax: ['withholdingTax'],
  costCenter: ['costCenter'],
  serialsAndNotes: ['serialNumbers'],
};

export function columnsFromDocumentProfile(
  visibleColumns?: Array<DocumentProfileColumnKey | string> | null
): InvoiceLineColumnId[] {
  const extra = new Set<InvoiceLineColumnId>();
  for (const key of visibleColumns ?? []) {
    const cols = GROUP_TO_COLUMNS[key as DocumentProfileColumnKey];
    if (!cols) continue;
    for (const id of cols) extra.add(id);
  }
  const merged = new Set<InvoiceLineColumnId>([...SALES_INVOICE_STORAGE_DEFAULT, ...extra]);
  return INVOICE_LINE_COLUMN_DEFS.filter((c) => merged.has(c.id)).map((c) => c.id);
}
