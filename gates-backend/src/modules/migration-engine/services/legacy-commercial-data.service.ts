import type { LegacySourceAdapter } from '../types';
import { legacyTrim } from '../transforms/legacy-values';
import { CURSOR_KEY_COLUMN, finishKeysetPage, keyExpr, keyPart } from './legacy-keyset-cursor';

/** Year|Branch|Type|InvoiceNum — keyset cursor for invoice headers (filter, sort and next cursor). */
const INVOICE_HEADER_KEY_SQL = `(${keyExpr(['h.YearID', 'h.BranchCode', 'h.Type', 'h.InvoiceNum'].map(keyPart))})`;
/** Year|Branch|Type|CashNum — keyset cursor for cash voucher headers. */
const CASH_HEADER_KEY_SQL = `(${keyExpr(['h.YearID', 'h.BranchCode', 'h.Type', 'h.CashNum'].map(keyPart))})`;

export type LegacyInvoiceHeaderRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  Type?: unknown;
  InvoiceNum?: unknown;
  Date?: unknown;
  DateH?: unknown;
  GLNum?: unknown;
  Status?: unknown;
  Deleted?: unknown;
  CustomerCode?: unknown;
  SupplierCode?: unknown;
  SupplierAccountCode?: unknown;
  StoreCode?: unknown;
  CurrencyCode?: unknown;
  Change?: unknown;
  TotalValue?: unknown;
  TotalAmount?: unknown;
  DiscountValue?: unknown;
  OfferAmount?: unknown;
  DaribaValue?: unknown;
  SalesDaribaAmount?: unknown;
  NetValue?: unknown;
  NetAmount?: unknown;
  RemainingValue?: unknown;
  CashType?: unknown;
  ReturnInvoiceType?: unknown;
  ReturnInvoiceNum?: unknown;
  ReturnInvoiceYearID?: unknown;
  SourceType?: unknown;
  SourceNum?: unknown;
  DescA?: unknown;
  DescE?: unknown;
  AllowReturn?: unknown;
  Days?: unknown;
  AffectStore?: unknown;
  CCenter?: unknown;
  PaidAmount?: unknown;
  OrderNum?: unknown;
  OrderType?: unknown;
  OrderYearID?: unknown;
  [key: string]: unknown;
};

/**
 * Catalog InvoiceTrxHeader only. SQL Server rejects COALESCE of a missing physical
 * column (NetValue, TotalValue, RemainingValue, CustomerCode, …) even when the
 * fallback exists. Aliases keep the transform field names.
 */
export const invoiceHeaderSelectSql = `
        h.CompanyCode, h.BranchCode, h.YearID, h.Type, h.InvoiceNum, h.Date, h.DateH, h.GLNum,
        h.Status, h.Deleted,
        h.SupplierAccountCode AS CustomerCode,
        h.SupplierAccountCode AS SupplierCode,
        h.SupplierAccountCode,
        h.StoreCode, h.CurrencyCode, h.Change,
        h.TotalAmount AS TotalValue,
        ISNULL(h.OfferAmount, 0) AS DiscountValue,
        h.SalesDaribaAmount AS DaribaValue,
        h.NetAmount AS NetValue,
        (ISNULL(h.NetAmount, 0) - ISNULL(h.PaidAmount, 0)) AS RemainingValue,
        h.CashType, h.ReturnInvoiceType, h.ReturnInvoiceNum, h.ReturnInvoiceYearID,
        h.SourceType, h.SourceNum, h.DescA, h.DescE, h.AllowReturn, h.Days, h.AffectStore, h.CCenter,
        h.PaidAmount, h.OrderNum, h.OrderType, h.OrderYearID,
        h.IsPeriodic, h.PayAccount, h.EtmadCode, h.IANum, h.IAYearId, h.IAType, h.UserCode`;

/** Catalog CashTrxHeader only — no TrxNum/VoucherNum/CustomerCode/Value/AccountCode. */
export const cashHeaderSelectSql = `
        h.CompanyCode, h.BranchCode, h.YearID, h.Type, h.CashNum,
        h.Date, h.Status, h.Deleted,
        h.AccountNo AS AccountCode,
        h.AccountNo AS CustomerCode,
        h.AccountNo AS SupplierCode,
        h.Amount, h.Amount AS Value,
        h.CurrencyCode, h.GLNum, h.DescA,
        h.DescA AS Description,
        h.Type AS TrxType`;

export type LegacyInvoiceDetailRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  Type?: unknown;
  InvoiceNum?: unknown;
  ItemCode?: unknown;
  LineNum?: unknown;
  GridNum?: unknown;
  Serial?: unknown;
  Qty1?: unknown;
  Qty2?: unknown;
  Quantity?: unknown;
  Qty?: unknown;
  UnitCode1?: unknown;
  UnitCode2?: unknown;
  Price?: unknown;
  UnitPrice?: unknown;
  TotalValue?: unknown;
  DiscountValue?: unknown;
  DaribaValue?: unknown;
  DiscPercent?: unknown;
  DiscValue?: unknown;
  DaribaPercent?: unknown;
  NetValue?: unknown;
  CostPrice?: unknown;
  SerialNums?: unknown;
  ItemDesc?: unknown;
  ItemColorSizeCode?: unknown;
  ExpDate?: unknown;
  StoreCode?: unknown;
  CCenter?: unknown;
  ItemWeight?: unknown;
  Weight?: unknown;
  Width?: unknown;
  Length?: unknown;
  QtyUsed1?: unknown;
  QtyUsed2?: unknown;
  QtyReturned1?: unknown;
  QtyReturned2?: unknown;
};

export type LegacyCashHeaderRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  Type?: unknown;
  CashNum?: unknown;
  TrxNum?: unknown;
  VoucherNum?: unknown;
  Date?: unknown;
  Status?: unknown;
  Deleted?: unknown;
  CustomerCode?: unknown;
  SupplierCode?: unknown;
  AccountCode?: unknown;
  AccountNo?: unknown;
  Amount?: unknown;
  Value?: unknown;
  CurrencyCode?: unknown;
  Change?: unknown;
  GLNum?: unknown;
  DescA?: unknown;
  Description?: unknown;
  TrxType?: unknown;
  CashType?: unknown;
};

export function invoiceHeaderCursor(row: LegacyInvoiceHeaderRow): string {
  return [
    legacyTrim(row.YearID),
    legacyTrim(row.BranchCode),
    legacyTrim(row.Type),
    legacyTrim(row.InvoiceNum),
  ].join('|');
}

export type InvoiceShellMode = 'DRAFT' | 'CANCELLED';

export async function loadHistoricalInvoiceShellBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  mode: InvoiceShellMode,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyInvoiceHeaderRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 200));
  const cursorFilter = cursor ? `AND ${INVOICE_HEADER_KEY_SQL} > @cursor` : '';
  const statusFilter =
    mode === 'CANCELLED'
      ? `RTRIM(ISNULL(h.Deleted,''))='T'`
      : `RTRIM(ISNULL(h.Deleted,''))<>'T' AND RTRIM(ISNULL(h.Status,''))<>'Post'`;
  const rows = await adapter.querySql<LegacyInvoiceHeaderRow>(
    `SELECT TOP (${lim})
        ${invoiceHeaderSelectSql},
        ${INVOICE_HEADER_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.InvoiceTrxHeader h
     WHERE RTRIM(h.CompanyCode)=@cc
       AND ${statusFilter}
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}

export async function loadPostedInvoiceHeaderBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyInvoiceHeaderRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 200));
  const cursorFilter = cursor ? `AND ${INVOICE_HEADER_KEY_SQL} > @cursor` : '';
  const rows = await adapter.querySql<LegacyInvoiceHeaderRow>(
    `SELECT TOP (${lim})
        ${invoiceHeaderSelectSql},
        ${INVOICE_HEADER_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.InvoiceTrxHeader h
     WHERE RTRIM(h.CompanyCode)=@cc
       AND RTRIM(h.Status)='Post'
       AND RTRIM(ISNULL(h.Deleted,''))<>'T'
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}

export async function loadInvoiceDetailsForHeader(
  adapter: LegacySourceAdapter,
  companyCode: string,
  header: LegacyInvoiceHeaderRow
): Promise<LegacyInvoiceDetailRow[]> {
  return adapter.querySql<LegacyInvoiceDetailRow>(
    `SELECT d.*
     FROM dbo.InvoiceTrxDetail d
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(d.BranchCode)=@br
       AND RTRIM(d.YearID)=@yr
       AND RTRIM(d.Type)=@typ
       AND RTRIM(d.InvoiceNum)=@num
     ORDER BY d.GridNum, d.Serial, d.ItemCode, d.Qty1, d.Price`,
    {
      cc: companyCode,
      br: legacyTrim(header.BranchCode),
      yr: legacyTrim(header.YearID),
      typ: legacyTrim(header.Type),
      num: legacyTrim(header.InvoiceNum),
    }
  );
}

export function cashHeaderCursor(row: LegacyCashHeaderRow): string {
  return [legacyTrim(row.YearID), legacyTrim(row.BranchCode), legacyTrim(row.Type), legacyTrim(row.CashNum ?? row.TrxNum)].join('|');
}

export async function loadPostedCashHeaderBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyCashHeaderRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 200));
  const cursorFilter = cursor ? `AND ${CASH_HEADER_KEY_SQL} > @cursor` : '';
  const rows = await adapter.querySql<LegacyCashHeaderRow>(
    `SELECT TOP (${lim})
        ${cashHeaderSelectSql},
        ${CASH_HEADER_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.CashTrxHeader h
     WHERE RTRIM(h.CompanyCode)=@cc
       AND RTRIM(h.Status)='Post'
       AND RTRIM(ISNULL(h.Deleted,''))<>'T'
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}

export type LegacyCashDetailRow = {
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
  InvoiceType?: unknown;
  InvoiceYearId?: unknown;
  InvoiceNum?: unknown;
  DetailDescA?: unknown;
};

export async function loadCashTrxDetailsForHeader(
  adapter: LegacySourceAdapter,
  companyCode: string,
  header: LegacyCashHeaderRow
): Promise<LegacyCashDetailRow[]> {
  return adapter.querySql<LegacyCashDetailRow>(
    `SELECT d.*
     FROM dbo.CashTrxDetail d
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(d.BranchCode)=@br
       AND RTRIM(d.YearID)=@yr
       AND RTRIM(ISNULL(d.Type,''))=RTRIM(ISNULL(@typ,''))
       AND RTRIM(d.CashNum)=@num
     ORDER BY d.DetailNum`,
    {
      cc: companyCode,
      br: legacyTrim(header.BranchCode),
      yr: legacyTrim(header.YearID),
      typ: legacyTrim(header.Type),
      num: legacyTrim(header.CashNum ?? header.TrxNum),
    }
  );
}
