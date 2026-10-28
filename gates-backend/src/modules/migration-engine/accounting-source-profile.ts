import type { LegacySourceAdapter } from './types';
import { LEGACY_POSTED_DETAIL_EXISTS, LEGACY_POSTED_GL_HEADER_WHERE } from './coa/legacy-posted-gl';

export interface AccountingSourceCapabilities {
  hasAccountMaster: boolean;
  accountMasterTable: string | null;
  accountMasterRowCount: number;
  hasGlTrxHeader: boolean;
  hasGlTrxDetail: boolean;
  postedGlHeaderCount: number;
  hasBalanceAccountsH: boolean;
  hasBalanceAccountsD: boolean;
  balanceAccountsHRowCount: number;
  hasInvoiceTrxHeader: boolean;
  hasInvoiceTrxDetail: boolean;
  invoiceTrxHeaderRowCount: number;
  glAccountColumn: string;
  glPostedFilterColumns: string[];
}

export async function legacyTableExists(adapter: LegacySourceAdapter, name: string): Promise<boolean> {
  const rows = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM sys.tables WHERE name = @name AND is_ms_shipped = 0`,
    { name }
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

async function safeCountTable(
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

export async function buildAccountingSourceCapabilities(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
): Promise<AccountingSourceCapabilities> {
  const accountTable = (await legacyTableExists(adapter, 'Account'))
    ? 'Account'
    : (await legacyTableExists(adapter, 'Accounts'))
      ? 'Accounts'
      : null;

  const hasGlTrxHeader = await legacyTableExists(adapter, 'GLTrxHeader');
  const hasGlTrxDetail = await legacyTableExists(adapter, 'GLTrxDetail');
  const hasBalanceAccountsH = await legacyTableExists(adapter, 'BalanceAccountsH');
  const hasBalanceAccountsD = await legacyTableExists(adapter, 'BalanceAccountsD');
  const hasInvoiceTrxHeader = await legacyTableExists(adapter, 'InvoiceTrxHeader');
  const hasInvoiceTrxDetail = await legacyTableExists(adapter, 'InvoiceTrxDetail');

  let postedGlHeaderCount = 0;
  if (hasGlTrxHeader) {
    const posted = await adapter.querySql<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM dbo.GLTrxHeader h
       WHERE RTRIM(h.CompanyCode)=@cc AND ${LEGACY_POSTED_GL_HEADER_WHERE}`,
      { cc: legacyCompanyCode }
    );
    postedGlHeaderCount = Number(posted[0]?.cnt ?? 0);
  }

  const accountMasterRowCount = accountTable
    ? await safeCountTable(adapter, accountTable, legacyCompanyCode)
    : -1;

  return {
    hasAccountMaster: Boolean(accountTable),
    accountMasterTable: accountTable,
    accountMasterRowCount,
    hasGlTrxHeader,
    hasGlTrxDetail,
    postedGlHeaderCount,
    hasBalanceAccountsH,
    hasBalanceAccountsD,
    balanceAccountsHRowCount: hasBalanceAccountsH
      ? await safeCountTable(adapter, 'BalanceAccountsH', legacyCompanyCode)
      : -1,
    hasInvoiceTrxHeader,
    hasInvoiceTrxDetail,
    invoiceTrxHeaderRowCount: hasInvoiceTrxHeader
      ? await safeCountTable(adapter, 'InvoiceTrxHeader', legacyCompanyCode)
      : -1,
    glAccountColumn: 'AccountNo',
    glPostedFilterColumns: ['Status', 'Deleted'],
  };
}

export async function countDistinctPostedGlAccounts(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
): Promise<number> {
  const rows = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(DISTINCT RTRIM(d.AccountNo)) AS cnt
     FROM dbo.GLTrxDetail d
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(ISNULL(d.AccountNo,'')) <> ''
       AND ${LEGACY_POSTED_DETAIL_EXISTS}`,
    { cc: legacyCompanyCode }
  );
  return Number(rows[0]?.cnt ?? 0);
}
