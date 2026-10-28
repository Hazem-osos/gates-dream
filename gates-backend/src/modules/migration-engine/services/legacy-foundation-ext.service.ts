import type { LegacySourceAdapter } from '../types';
import { legacyTrim } from '../transforms/legacy-values';
import { legacyTableExists } from '../accounting-source-profile';
import { CURSOR_KEY_COLUMN, finishKeysetPage, keyExpr, keyPart } from './legacy-keyset-cursor';

/** Branch|Name — keyset cursor (filter, sort and next cursor). */
const COMPANY_SETTING_KEY_SQL = `(${keyExpr(['BranchCode', 'Name'].map(keyPart))})`;

export type LegacyCompanySettingRow = {
  Name?: unknown;
  Value?: unknown;
  BranchCode?: unknown;
  AdditionalData?: unknown;
};

export function companySettingCursor(row: LegacyCompanySettingRow): string {
  return [legacyTrim(row.BranchCode), legacyTrim(row.Name)].join('|');
}

export async function loadCompanySettingBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyCompanySettingRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 500));
  const cursorFilter = cursor
    ? `AND ${COMPANY_SETTING_KEY_SQL} > @cursor`
    : '';
  const rows = await adapter.querySql<LegacyCompanySettingRow>(
    `SELECT TOP (${lim}) Name, Value, BranchCode, AdditionalData,
        ${COMPANY_SETTING_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.CompanySetting
     WHERE RTRIM(CompanyCode)=@cc
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}

export async function loadDistinctLegacyBankAccountCodes(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<string[]> {
  const codes = new Set<string>();
  if (await legacyTableExists(adapter, 'CashTrxotherDetail')) {
    const rows = await adapter.querySql<{ BankAccountNo?: unknown }>(
      `SELECT DISTINCT RTRIM(BankAccountNo) AS BankAccountNo
       FROM dbo.CashTrxotherDetail
       WHERE RTRIM(CompanyCode)=@cc AND RTRIM(ISNULL(BankAccountNo,''))<>''`,
      { cc: companyCode }
    );
    for (const r of rows) {
      const c = legacyTrim(r.BankAccountNo);
      if (c) codes.add(c);
    }
  }
  if (await legacyTableExists(adapter, 'CKTrxDetail')) {
    const rows = await adapter.querySql<{ BankAccountNo?: unknown }>(
      `SELECT DISTINCT RTRIM(BankAccountNo) AS BankAccountNo
       FROM dbo.CKTrxDetail
       WHERE RTRIM(CompanyCode)=@cc AND RTRIM(ISNULL(BankAccountNo,''))<>''`,
      { cc: companyCode }
    );
    for (const r of rows) {
      const c = legacyTrim(r.BankAccountNo);
      if (c) codes.add(c);
    }
  }
  return [...codes];
}

export type LegacyCashOtherDetailRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  CashNum?: unknown;
  Type?: unknown;
  DetailNum?: unknown;
  AccountNo?: unknown;
  CCenterCode?: unknown;
  Amount?: unknown;
  CurrencyCode?: unknown;
  Change?: unknown;
  Accepted?: unknown;
  BankAccountNo?: unknown;
  DetailDescA?: unknown;
  DetailDescE?: unknown;
};

export function cashOtherDetailCursor(row: LegacyCashOtherDetailRow): string {
  return [
    legacyTrim(row.YearID),
    legacyTrim(row.BranchCode),
    legacyTrim(row.Type),
    legacyTrim(row.CashNum),
    legacyTrim(row.DetailNum),
  ].join('|');
}

export async function loadCashTrxotherDetailForHeader(
  adapter: LegacySourceAdapter,
  companyCode: string,
  header: { BranchCode?: unknown; YearID?: unknown; Type?: unknown; CashNum?: unknown; TrxNum?: unknown }
): Promise<LegacyCashOtherDetailRow[]> {
  if (!(await legacyTableExists(adapter, 'CashTrxotherDetail'))) return [];
  return adapter.querySql<LegacyCashOtherDetailRow>(
    `SELECT CompanyCode, BranchCode, YearID, CashNum, Type, DetailNum,
            AccountNo, CCenterCode, Amount, CurrencyCode, Change, Accepted,
            BankAccountNo, DetailDescA, DetailDescE
     FROM dbo.CashTrxotherDetail
     WHERE RTRIM(CompanyCode)=@cc
       AND RTRIM(BranchCode)=@br
       AND RTRIM(YearID)=@yr
       AND RTRIM(ISNULL(Type,''))=RTRIM(ISNULL(@typ,''))
       AND RTRIM(CashNum)=@num
     ORDER BY DetailNum`,
    {
      cc: companyCode,
      br: legacyTrim(header.BranchCode),
      yr: legacyTrim(header.YearID),
      typ: legacyTrim(header.Type),
      num: legacyTrim(header.CashNum ?? header.TrxNum),
    }
  );
}
