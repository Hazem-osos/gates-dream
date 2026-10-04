import type { LegacySourceAdapter } from '../types';

export interface PartySourceProfile {
  legacyCompanyCode: string;
  customerTable: string | null;
  supplierTable: string | null;
  customerCategoryTable: string | null;
  supplierCategoryTable: string | null;
  customerRowCount: number;
  supplierRowCount: number;
  customerCategoryRowCount: number;
  supplierCategoryRowCount: number;
  customerColumns: string[];
  supplierColumns: string[];
  balanceFieldHints: Array<{ table: string; column: string; classification: 'REFERENCE_ONLY' | 'CACHE' | 'UNKNOWN' }>;
}

async function tableExists(adapter: LegacySourceAdapter, name: string): Promise<boolean> {
  const rows = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM sys.tables WHERE name=@name AND is_ms_shipped=0`,
    { name }
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

async function columns(adapter: LegacySourceAdapter, table: string): Promise<string[]> {
  const rows = await adapter.querySql<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@t ORDER BY ORDINAL_POSITION`,
    { t: table }
  );
  return rows.map((r) => r.COLUMN_NAME);
}

async function safeCount(adapter: LegacySourceAdapter, table: string, cc: string): Promise<number> {
  try {
    return await adapter.count(table, cc);
  } catch {
    return -1;
  }
}

export async function buildPartySourceProfile(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
): Promise<PartySourceProfile> {
  const customerTable = (await tableExists(adapter, 'Customer')) ? 'Customer' : null;
  const supplierTable = (await tableExists(adapter, 'Supplier')) ? 'Supplier' : null;
  const customerCategoryTable = (await tableExists(adapter, 'CustomerCategory'))
    ? 'CustomerCategory'
    : null;
  const supplierCategoryTable = (await tableExists(adapter, 'SupplierCategory'))
    ? 'SupplierCategory'
    : null;

  const balanceFieldHints: PartySourceProfile['balanceFieldHints'] = [];
  if (customerTable) {
    const cols = await columns(adapter, customerTable);
    if (cols.includes('Mozana')) {
      balanceFieldHints.push({ table: customerTable, column: 'Mozana', classification: 'CACHE' });
    }
  }
  if (supplierTable) {
    const cols = await columns(adapter, supplierTable);
    if (cols.includes('Mozana')) {
      balanceFieldHints.push({ table: supplierTable, column: 'Mozana', classification: 'CACHE' });
    }
  }

  return {
    legacyCompanyCode,
    customerTable,
    supplierTable,
    customerCategoryTable,
    supplierCategoryTable,
    customerRowCount: customerTable ? await safeCount(adapter, customerTable, legacyCompanyCode) : -1,
    supplierRowCount: supplierTable ? await safeCount(adapter, supplierTable, legacyCompanyCode) : -1,
    customerCategoryRowCount: customerCategoryTable
      ? Number(
          (
            await adapter.querySql<{ cnt: number }>(
              `SELECT COUNT(*) AS cnt FROM dbo.[${customerCategoryTable}]`
            )
          )[0]?.cnt ?? 0
        )
      : -1,
    supplierCategoryRowCount: supplierCategoryTable
      ? await safeCount(adapter, supplierCategoryTable, legacyCompanyCode)
      : -1,
    customerColumns: customerTable ? await columns(adapter, customerTable) : [],
    supplierColumns: supplierTable ? await columns(adapter, supplierTable) : [],
    balanceFieldHints,
  };
}
