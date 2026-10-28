import type { LegacySourceAdapter } from '../types';
import { legacyTrim } from '../transforms/legacy-values';
import { CURSOR_KEY_COLUMN, finishKeysetPage, keyExpr, keyPart } from './legacy-keyset-cursor';

/** Year|Branch|Type|CashNum|DetailNum — keyset cursor (filter, sort and next cursor). */
const CASH_ALLOCATION_KEY_SQL = `(${keyExpr(['d.YearID', 'd.BranchCode', 'd.Type', 'd.CashNum', 'd.DetailNum'].map(keyPart))})`;

/** CashTrxDetail row with invoice allocation evidence (see erp_schema.txt / DEEP-MINING CashTrxDetail). */
export type LegacyCashInvoiceAllocationRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  CashNum?: unknown;
  Type?: unknown;
  DetailNum?: unknown;
  Amount?: unknown;
  CurrencyCode?: unknown;
  Change?: unknown;
  Accepted?: unknown;
  InvoiceType?: unknown;
  InvoiceYearId?: unknown;
  InvoiceNum?: unknown;
  DetailDescA?: unknown;
  CashDate?: unknown;
};

export function cashAllocationCursor(row: LegacyCashInvoiceAllocationRow): string {
  return [
    legacyTrim(row.YearID),
    legacyTrim(row.BranchCode),
    legacyTrim(row.Type),
    legacyTrim(row.CashNum),
    legacyTrim(row.DetailNum),
  ].join('|');
}

export async function loadCashInvoiceAllocationBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyCashInvoiceAllocationRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 200));
  const cursorFilter = cursor
    ? `AND ${CASH_ALLOCATION_KEY_SQL} > @cursor`
    : '';
  const rows = await adapter.querySql<LegacyCashInvoiceAllocationRow>(
    `SELECT TOP (${lim})
        d.CompanyCode, d.BranchCode, d.YearID, d.CashNum, d.Type, d.DetailNum,
        d.Amount, d.CurrencyCode, d.Change, d.Accepted,
        d.InvoiceType, d.InvoiceYearId, d.InvoiceNum, d.DetailDescA,
        h.Date AS CashDate,
        ${CASH_ALLOCATION_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.CashTrxDetail d
     INNER JOIN dbo.CashTrxHeader h
       ON RTRIM(h.CompanyCode)=RTRIM(d.CompanyCode)
      AND RTRIM(h.BranchCode)=RTRIM(d.BranchCode)
      AND RTRIM(h.YearID)=RTRIM(d.YearID)
      AND RTRIM(ISNULL(h.Type,''))=RTRIM(ISNULL(d.Type,''))
      AND RTRIM(h.CashNum)=RTRIM(d.CashNum)
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(ISNULL(d.InvoiceNum,''))<>''
       AND RTRIM(ISNULL(d.InvoiceType,''))<>''
       AND RTRIM(h.Status)='Post'
       AND RTRIM(ISNULL(h.Deleted,''))<>'T'
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}

export async function countCashInvoiceAllocationRows(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<number> {
  const rows = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt
     FROM dbo.CashTrxDetail d
     INNER JOIN dbo.CashTrxHeader h
       ON RTRIM(h.CompanyCode)=RTRIM(d.CompanyCode)
      AND RTRIM(h.BranchCode)=RTRIM(d.BranchCode)
      AND RTRIM(h.YearID)=RTRIM(d.YearID)
      AND RTRIM(ISNULL(h.Type,''))=RTRIM(ISNULL(d.Type,''))
      AND RTRIM(h.CashNum)=RTRIM(d.CashNum)
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(ISNULL(d.InvoiceNum,''))<>''
       AND RTRIM(ISNULL(d.InvoiceType,''))<>''
       AND RTRIM(h.Status)='Post'
       AND RTRIM(ISNULL(h.Deleted,''))<>'T'`,
    { cc: companyCode }
  );
  return Number(rows[0]?.cnt ?? 0);
}
