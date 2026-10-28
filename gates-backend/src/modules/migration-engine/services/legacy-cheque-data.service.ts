import type { LegacySourceAdapter } from '../types';
import { legacyTrim } from '../transforms/legacy-values';
import {
  CURSOR_KEY_COLUMN,
  dateKeyPart,
  finishKeysetPage,
  keyExpr,
  keyPart,
} from './legacy-keyset-cursor';

// Keyset cursors: one SQL expression for filter, sort and next cursor (legacy-keyset-cursor.ts).
const CK_DETAIL_KEY_SQL = `(${keyExpr(['d.YearID', 'd.BranchCode', 'd.Type', 'd.CKNum', 'd.Id'].map(keyPart))})`;
const PK_DETAIL_KEY_SQL = `(${keyExpr(['d.YearID', 'd.BranchCode', 'd.Type', 'd.PKNum', 'd.IdNum'].map(keyPart))})`;
const CK_SUB_KEY_SQL = `(${keyExpr([...['s.YearID', 's.BranchCode', 's.Type', 's.CKNum', 's.TakeGLNum'].map(keyPart), dateKeyPart('s.TakeAmountDate')])})`;
const PK_SUB_KEY_SQL = `(${keyExpr([...['s.YearID', 's.BranchCode', 's.Type', 's.PKNum', 's.TakeGLNum'].map(keyPart), dateKeyPart('s.TakeAmountDate')])})`;

/** One legacy cheque line (CKTrxDetail — no separate CKTrxHeader in erp_schema.txt). */
export type LegacyChequeLineRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  CKNum?: unknown;
  PKNum?: unknown;
  Type?: unknown;
  FromAccountNo?: unknown;
  Amount?: unknown;
  CurrencyCode?: unknown;
  Change?: unknown;
  Name?: unknown;
  IdNum?: unknown;
  Id?: unknown;
  AccountNo?: unknown;
  GehaCode?: unknown;
  EditDate?: unknown;
  TakeDate?: unknown;
  DueDate?: unknown;
  BankDate?: unknown;
  Status?: unknown;
  Deleted?: unknown;
  IsTake?: unknown;
  IsTazher?: unknown;
  IsReturn?: unknown;
  IsBank?: unknown;
  EditGLNum?: unknown;
  TakeGLNum?: unknown;
  TazherGLNum?: unknown;
  ReturnGLNum?: unknown;
  BankGLNum?: unknown;
  BankAccountNo?: unknown;
  TakeYearID?: unknown;
  TazherYearID?: unknown;
  ReturnYearID?: unknown;
  BankYearID?: unknown;
  DetailDescA?: unknown;
  DetailDescE?: unknown;
};

export type LegacyCkTrxDetailRow = LegacyChequeLineRow;

export function chequeLineCursor(row: LegacyChequeLineRow, voucherField: 'CKNum' | 'PKNum'): string {
  return [
    legacyTrim(row.YearID),
    legacyTrim(row.BranchCode),
    legacyTrim(row.Type),
    legacyTrim(row[voucherField]),
    legacyTrim(row.Id),
    legacyTrim(row.IdNum),
  ].join('|');
}

export function ckTrxDetailCursor(row: LegacyChequeLineRow): string {
  return chequeLineCursor(row, 'CKNum');
}

export function pkTrxDetailCursor(row: LegacyChequeLineRow): string {
  return chequeLineCursor(row, 'PKNum');
}

export async function loadCkTrxDetailBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyCkTrxDetailRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 200));
  const cursorFilter = cursor
    ? `AND ${CK_DETAIL_KEY_SQL} > @cursor`
    : '';
  const rows = await adapter.querySql<LegacyCkTrxDetailRow>(
    `SELECT TOP (${lim}) d.*, ${CK_DETAIL_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.CKTrxDetail d
     WHERE RTRIM(d.CompanyCode)=@cc
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}

export async function loadPkTrxDetailBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyChequeLineRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 200));
  const cursorFilter = cursor
    ? `AND ${PK_DETAIL_KEY_SQL} > @cursor`
    : '';
  const rows = await adapter.querySql<LegacyChequeLineRow>(
    `SELECT TOP (${lim}) d.*, ${PK_DETAIL_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.PKTrxDetail d
     WHERE RTRIM(d.CompanyCode)=@cc
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}

export type LegacyCkTrxDetailSubRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  CKNum?: unknown;
  Type?: unknown;
  TakeGLNum?: unknown;
  TakeAmount?: unknown;
  TakeAmountDate?: unknown;
  TakeAccountNo?: unknown;
  TakeYearID?: unknown;
};

export function ckSubCursor(row: LegacyCkTrxDetailSubRow): string {
  return [
    legacyTrim(row.YearID),
    legacyTrim(row.BranchCode),
    legacyTrim(row.Type),
    legacyTrim(row.CKNum),
    legacyTrim(row.TakeGLNum),
    legacyTrim(row.TakeAmountDate),
  ].join('|');
}

export async function loadCkTrxDetailSubBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyCkTrxDetailSubRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 200));
  const cursorFilter = cursor
    ? `AND ${CK_SUB_KEY_SQL} > @cursor`
    : '';
  const rows = await adapter.querySql<LegacyCkTrxDetailSubRow>(
    `SELECT TOP (${lim}) s.*, ${CK_SUB_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.CKTrxDetailSub s
     WHERE RTRIM(s.CompanyCode)=@cc
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}

export type LegacyPkTrxDetailSubRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  PKNum?: unknown;
  Type?: unknown;
  TakeGLNum?: unknown;
  TakeAmount?: unknown;
  TakeAmountDate?: unknown;
  TakeAccountNo?: unknown;
  TakeYearID?: unknown;
  CKNum?: unknown;
};

export function pkSubCursor(row: LegacyPkTrxDetailSubRow): string {
  return [
    legacyTrim(row.YearID),
    legacyTrim(row.BranchCode),
    legacyTrim(row.Type),
    legacyTrim(row.PKNum),
    legacyTrim(row.TakeGLNum),
    legacyTrim(row.TakeAmountDate),
  ].join('|');
}

export async function loadPkTrxDetailSubBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<{ rows: LegacyPkTrxDetailSubRow[]; nextCursor: string | null }> {
  const lim = Math.max(1, Math.min(limit, 200));
  const cursorFilter = cursor
    ? `AND ${PK_SUB_KEY_SQL} > @cursor`
    : '';
  const rows = await adapter.querySql<LegacyPkTrxDetailSubRow>(
    `SELECT TOP (${lim}) s.*, ${PK_SUB_KEY_SQL} AS ${CURSOR_KEY_COLUMN}
     FROM dbo.PKTrxDetailSub s
     WHERE RTRIM(s.CompanyCode)=@cc
       ${cursorFilter}
     ORDER BY ${CURSOR_KEY_COLUMN}`,
    { cc: companyCode, ...(cursor ? { cursor } : {}) }
  );
  return finishKeysetPage(rows, lim);
}
