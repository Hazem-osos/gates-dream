import type { LegacySourceAdapter } from './types';

/** Detected capabilities of a legacy Gates SQL Server source (not hardcoded to Agro2). */
export interface LegacySourceProfile {
  databaseName: string;
  legacyCompanyCode: string;
  tableCount: number;
  hasItemStore: boolean;
  itemStoreRowCount: number;
  hasStoreTransDetail: boolean;
  storeTransDetailRowCount: number;
  hasItemCost: boolean;
  hasGL: boolean;
  glHeaderCount: number;
  hasInvoiceTables: boolean;
  invoiceRowCount: number;
  hasBalanceAccounts: boolean;
  balanceAccountRowCount: number;
  hasOpeningStock: boolean;
  openingStockRowCount: number;
  hasPerformedFlag: boolean;
  inventoryQuantitySourceHint: string;
}

export async function buildLegacySourceProfile(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
): Promise<LegacySourceProfile> {
  const databaseName = await adapter.getDatabaseName();
  const tableCountRows = await adapter.querySql<{ table_count: number }>(
    `SELECT COUNT(*) AS table_count FROM sys.tables WHERE is_ms_shipped = 0`
  );
  const itemStoreRowCount = await safeCount(adapter, 'ItemStore', legacyCompanyCode);
  const storeTransDetailRowCount = await safeCount(adapter, 'StoreTransDetail', legacyCompanyCode);
  const glHeaderCount = await safeCount(adapter, 'GLTrxHeader', legacyCompanyCode);
  let invoiceRowCount = await safeCount(adapter, 'InvoiceTrxHeader', legacyCompanyCode);
  if (invoiceRowCount < 0) invoiceRowCount = await safeCount(adapter, 'Invoice', legacyCompanyCode);
  let balanceAccountRowCount = await safeCount(adapter, 'BalanceAccountsH', legacyCompanyCode);
  if (balanceAccountRowCount < 0) {
    balanceAccountRowCount = await safeCount(adapter, 'BalanceAccount', legacyCompanyCode);
  }
  const openingStockRowCount = await safeCount(adapter, 'OpeningStock', legacyCompanyCode);
  const performedProbe = await adapter.querySql<{ has_col: number }>(
    `SELECT COUNT(*) AS has_col FROM sys.columns c
     INNER JOIN sys.tables t ON c.object_id = t.object_id
     WHERE t.name = 'Invoice' AND c.name = 'Performed'`
  );

  const profile: LegacySourceProfile = {
    databaseName,
    legacyCompanyCode,
    tableCount: tableCountRows[0]?.table_count ?? 0,
    hasItemStore: itemStoreRowCount >= 0,
    itemStoreRowCount,
    hasStoreTransDetail: storeTransDetailRowCount >= 0,
    storeTransDetailRowCount,
    hasItemCost: (await safeCount(adapter, 'ItemCost', legacyCompanyCode)) >= 0,
    hasGL: glHeaderCount > 0,
    glHeaderCount,
    hasInvoiceTables: invoiceRowCount >= 0,
    invoiceRowCount,
    hasBalanceAccounts: balanceAccountRowCount >= 0,
    balanceAccountRowCount,
    hasOpeningStock: openingStockRowCount >= 0,
    openingStockRowCount,
    hasPerformedFlag: (performedProbe[0]?.has_col ?? 0) > 0,
    inventoryQuantitySourceHint: '',
  };
  profile.inventoryQuantitySourceHint = inventoryQuantitySourceHint(profile);
  return profile;
}

async function safeCount(
  adapter: LegacySourceAdapter,
  table: string,
  legacyCompanyCode: string
): Promise<number> {
  try {
    return await adapter.count(table, legacyCompanyCode);
  } catch {
    return -1;
  }
}

/** Policy: empty ItemStore must not be treated as authoritative stock for this source. */
export function inventoryQuantitySourceHint(profile: LegacySourceProfile): string {
  if (profile.itemStoreRowCount === 0 && profile.storeTransDetailRowCount > 0) {
    return 'DERIVE_FROM_STORE_TRANS_DETAIL';
  }
  if (profile.itemStoreRowCount > 0) {
    return 'ITEMSTORE_POPULATED_REVIEW_REQUIRED';
  }
  return 'UNKNOWN_INVENTORY_EVIDENCE';
}
