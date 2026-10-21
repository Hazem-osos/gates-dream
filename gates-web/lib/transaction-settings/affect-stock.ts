import type { TransactionSettings } from '@/lib/transaction-settings/types';
import type { InvoiceLineColumnId } from '@/lib/invoices/invoiceLineColumns';
import {
  complementarySourceTypes,
  type SelectableSourceType,
} from '@/lib/invoices/sourceDocument';

export function transactionAffectsStock(
  settings?: Pick<TransactionSettings, 'affectStock'> | null
): boolean {
  return settings?.affectStock !== false;
}

/** Hidden on non-stock invoices — batch/serial only (warehouse + balance stay optional in the grid). */
const STOCK_ONLY_COLUMN_IDS = new Set<InvoiceLineColumnId>([
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
  return columnIds.filter((id) => !STOCK_ONLY_COLUMN_IDS.has(id));
}

const DEFAULT_INVOICE_STOCK_POLICIES = {
  salesInvoiceAffectsStock: true,
  purchaseInvoiceAffectsStock: true,
};

/**
 * فاتورة تؤثر على المخزن → أقسام لا تؤثر على المخزن.
 * لا تؤثر → كل الأقسام.
 */
export function salesInvoiceSourceTypes(affectsStock: boolean): readonly SelectableSourceType[] {
  return complementarySourceTypes(affectsStock, DEFAULT_INVOICE_STOCK_POLICIES);
}

/**
 * فاتورة مشتريات تؤثر على المخزن → أقسام لا تؤثر على المخزن.
 * لا تؤثر → كل الأقسام.
 */
export function purchaseInvoiceSourceTypes(affectsStock: boolean): readonly SelectableSourceType[] {
  return complementarySourceTypes(affectsStock, DEFAULT_INVOICE_STOCK_POLICIES);
}
