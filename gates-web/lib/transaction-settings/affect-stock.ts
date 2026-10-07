import type { TransactionSettings } from '@/lib/transaction-settings/types';
import type { InvoiceLineColumnId } from '@/lib/invoices/invoiceLineColumns';
import {
  PURCHASE_INVOICE_SOURCE_TYPES,
  SALES_INVOICE_SOURCE_TYPES,
  type SelectableSourceType,
} from '@/lib/invoices/sourceDocument';

export function transactionAffectsStock(
  settings?: Pick<TransactionSettings, 'affectStock'> | null
): boolean {
  return settings?.affectStock !== false;
}

const STOCK_RELATED_COLUMN_IDS = new Set<InvoiceLineColumnId>([
  'warehouse',
  'stockBalance',
  'batchAndExpiry',
  'batchNumber',
  'expiryDate',
  'productionDate',
  'serialNumbers',
]);

export function invoiceLineColumnsForStockPolicy(
  columnIds: InvoiceLineColumnId[],
  affectsStock: boolean
): InvoiceLineColumnId[] {
  if (affectsStock) return columnIds;
  return columnIds.filter((id) => !STOCK_RELATED_COLUMN_IDS.has(id));
}

export function salesInvoiceSourceTypes(affectsStock: boolean): readonly SelectableSourceType[] {
  if (!affectsStock) {
    return SALES_INVOICE_SOURCE_TYPES.filter((t) => t !== 'DELIVERY_NOTE');
  }
  return SALES_INVOICE_SOURCE_TYPES;
}

export function purchaseInvoiceSourceTypes(affectsStock: boolean): readonly SelectableSourceType[] {
  if (!affectsStock) {
    return PURCHASE_INVOICE_SOURCE_TYPES;
  }
  return [...PURCHASE_INVOICE_SOURCE_TYPES, 'GOODS_RECEIPT'];
}
