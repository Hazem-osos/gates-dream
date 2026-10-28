/** Shared keyset-pagination defaults for connector + direct SQL adapters. */
export const CONNECTOR_ORDER_COLUMN_DEFAULTS: Record<string, string> = {
  Branch: 'BranchCode',
  Year: 'YearCode',
  CostCenter: 'CCenterCode',
  Store: 'StoreCode',
  Currency: 'CurrencyCode',
  Account: 'AccountCode',
  Accounts: 'AccountCode',
  Customer: 'CustomerCode',
  Supplier: 'SupplierCode',
};

export function resolveDefaultOrderColumn(table: string): string | null {
  return CONNECTOR_ORDER_COLUMN_DEFAULTS[table] ?? null;
}

export function sanitizeSqlIdentifier(name: string): string {
  const safe = name.replace(/[^\w]/g, '');
  if (!safe || safe.length > 128) {
    throw new Error('Invalid SQL identifier');
  }
  return safe;
}

export function clampBatchLimit(limit: number): number {
  return Math.max(1, Math.min(limit, 5000));
}
