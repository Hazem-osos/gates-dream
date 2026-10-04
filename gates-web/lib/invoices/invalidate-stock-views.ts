import { bumpMasterCatalog } from '@/lib/query/master-catalog-sync';

const STOCK_QUERY_ROOTS = [
  'items',
  'item',
  'item-quantities',
  'item-quantity',
  'warehouse-balances',
  'item-warehouse-balances',
  'customers',
  'suppliers',
  'invoices',
  'invoice',
  'receipts',
  'receipt',
  'issues',
  'issue',
  'transfers',
  'transfer',
  'adjustments',
  'adjustment',
  'opening-stocks',
  'stocktakings',
  'item-reservations',
  'item-stock-balance',
  'assemblies',
  'disassemblies',
  'purchase-orders',
  'sales-orders',
  'price-quotes',
  'units',
] as const;

/** Refresh quantities, balances, pickers, and party balances after a stock write. */
export function invalidateStockViews(invalidateQuery: (queryKey: readonly unknown[]) => void) {
  for (const root of STOCK_QUERY_ROOTS) {
    invalidateQuery([root]);
  }
  bumpMasterCatalog('item');
}
