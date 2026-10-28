import { LEGACY_POSTED_DETAIL_EXISTS, LEGACY_POSTED_GL_HEADER_WHERE } from '../coa/legacy-posted-gl';
import { money } from '../accounting/journal-money';
import { dedupePostedJournalHeaders } from '../accounting/journal-dedupe';
import type { LegacySourceAdapter } from '../types';
import { legacyTrim, padGlNum } from '../transforms/legacy-values';
import { CURSOR_KEY_COLUMN, finishKeysetPage } from './legacy-keyset-cursor';
import type { LegacyJournalHeaderInput, LegacyJournalLineInput } from '../transforms/journal-transform';

export interface LegacyJournalBatch {
  headers: LegacyJournalHeaderInput[];
  lines: LegacyJournalLineInput[];
  nextCursor: string | null;
}

export async function countPostedJournalHeaders(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<number> {
  const rows = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM (
        SELECT 1 AS x
        FROM dbo.GLTrxHeader h
        WHERE RTRIM(h.CompanyCode)=@cc AND ${LEGACY_POSTED_GL_HEADER_WHERE}
        GROUP BY RTRIM(h.YearID), RTRIM(h.BranchCode), RIGHT('00000000'+RTRIM(h.GlNum),8)
     ) uniq`,
    { cc: companyCode }
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function countCollapsedDuplicateHeaderGroups(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<number> {
  const rows = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM (
        SELECT 1 AS x
        FROM dbo.GLTrxHeader h
        WHERE RTRIM(h.CompanyCode)=@cc AND ${LEGACY_POSTED_GL_HEADER_WHERE}
        GROUP BY RTRIM(h.YearID), RTRIM(h.BranchCode), RIGHT('00000000'+RTRIM(h.GlNum),8)
        HAVING COUNT(*) > 1
     ) dup`,
    { cc: companyCode }
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function countOpeningGlHeaders(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<number> {
  const rows = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM dbo.GLTrxHeader h
     WHERE RTRIM(h.CompanyCode)=@cc AND ${LEGACY_POSTED_GL_HEADER_WHERE}
       AND RTRIM(ISNULL(h.Type,''))='BG01'`,
    { cc: companyCode }
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function countBalanceAccountHeaders(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<number> {
  try {
    const rows = await adapter.querySql<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM dbo.BalanceAccountsH
       WHERE RTRIM(CompanyCode)=@cc`,
      { cc: companyCode }
    );
    return Number(rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

export async function loadPostedJournalTotals(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<{
  debit: string;
  credit: string;
  lineCount: number;
  uniqueLineIdentities: number;
  zeroValueDuplicatePhysicalRows: number;
}> {
  const rows = await adapter.querySql<{ debit: unknown; credit: unknown; lines: number }>(
    `SELECT
        SUM(CAST(d.DebitValue AS DECIMAL(18,6)) * CAST(ISNULL(d.Change,1) AS DECIMAL(18,6))) AS debit,
        SUM(CAST(d.CreditValue AS DECIMAL(18,6)) * CAST(ISNULL(d.Change,1) AS DECIMAL(18,6))) AS credit,
        COUNT(*) AS lines
     FROM dbo.GLTrxDetail d
     WHERE RTRIM(d.CompanyCode)=@cc AND ${LEGACY_POSTED_DETAIL_EXISTS}`,
    { cc: companyCode }
  );
  const unique = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM (
        SELECT 1 AS x
        FROM dbo.GLTrxDetail d
        WHERE RTRIM(d.CompanyCode)=@cc AND ${LEGACY_POSTED_DETAIL_EXISTS}
        GROUP BY RTRIM(d.YearID), RTRIM(d.BranchCode), RIGHT('00000000'+RTRIM(d.GLNum),8),
                 d.DetailNum, RTRIM(ISNULL(d.AccountNo,'')),
                 CAST(d.DebitValue AS DECIMAL(18,6)), CAST(d.CreditValue AS DECIMAL(18,6))
     ) uniq`,
    { cc: companyCode }
  );
  const debit = money(rows[0]?.debit ?? 0);
  const credit = money(rows[0]?.credit ?? 0);
  const lineCount = Number(rows[0]?.lines ?? 0);
  const uniqueLineIdentities = Number(unique[0]?.cnt ?? 0);
  return {
    debit: debit.toDecimalPlaces(2).toFixed(2),
    credit: credit.toDecimalPlaces(2).toFixed(2),
    lineCount,
    uniqueLineIdentities,
    zeroValueDuplicatePhysicalRows: Math.max(0, lineCount - uniqueLineIdentities),
  };
}

export async function loadInvoiceReturnLinks(adapter: LegacySourceAdapter, companyCode: string) {
  return adapter.querySql<Record<string, unknown>>(
    `SELECT RTRIM(BranchCode) AS BranchCode, RTRIM(Type) AS Type, RTRIM(InvoiceNum) AS InvoiceNum, RTRIM(YearID) AS YearID, RTRIM(GLNum) AS GLNum,
            RTRIM(ReturnInvoiceType) AS ReturnInvoiceType, RTRIM(ReturnInvoiceNum) AS ReturnInvoiceNum,
            RTRIM(ReturnInvoiceYearID) AS ReturnInvoiceYearID
     FROM dbo.InvoiceTrxHeader
     WHERE RTRIM(CompanyCode)=@cc AND RTRIM(Status)='Post' AND RTRIM(ISNULL(Deleted,''))<>'T'
       AND RTRIM(ISNULL(ReturnInvoiceNum,''))<>''`,
    { cc: companyCode }
  );
}

export function journalCursorKey(row: LegacyJournalHeaderInput): string {
  const year = legacyTrim(row.YearID);
  const branch = legacyTrim(row.BranchCode);
  const gl = padGlNum(row.GlNum ?? row.GLNum);
  return `${year}|${branch}|${gl}`;
}

export async function loadPostedJournalBatch(
  adapter: LegacySourceAdapter,
  companyCode: string,
  cursor: string | null,
  limit: number
): Promise<LegacyJournalBatch> {
  const lim = Math.max(1, Math.min(limit, 200));
  // One key for filter, sort and next cursor — see legacy-keyset-cursor.ts.
  const key = JOURNAL_HEADER_KEY_SQL;
  const cursorFilter = cursor ? `AND ${key} > @cursor` : '';
  const sql = `SELECT TOP (${lim})
          CompanyCode, BranchCode, YearID, GlNum, Date, DateH, DescA, DescE,
          CurrencyCode, Status, Deleted, Type, SourceNum, GLInvoiceType,
          UserCode, Balanced, ${CURSOR_KEY_COLUMN}
       FROM (
         SELECT h.CompanyCode, h.BranchCode, h.YearID, h.GlNum, h.Date, h.DateH, h.DescA, h.DescE,
                h.CurrencyCode, h.Status, h.Deleted, h.Type, h.SourceNum, h.GLInvoiceType,
                h.UserCode, h.Balanced,
                ${key} AS ${CURSOR_KEY_COLUMN},
                ROW_NUMBER() OVER (
                  PARTITION BY RTRIM(h.YearID), RTRIM(h.BranchCode), RIGHT('00000000'+RTRIM(h.GlNum),8)
                  ORDER BY h.IdNum
                ) AS rn
         FROM dbo.GLTrxHeader h
         WHERE RTRIM(h.CompanyCode)=@cc AND ${LEGACY_POSTED_GL_HEADER_WHERE}
           ${cursorFilter}
       ) uniq
       WHERE rn = 1
       ORDER BY ${CURSOR_KEY_COLUMN}`;

  const page = finishKeysetPage(
    await adapter.querySql<LegacyJournalHeaderInput>(sql, {
      cc: companyCode,
      ...(cursor ? { cursor } : {}),
    }),
    lim
  );
  const { headers } = dedupePostedJournalHeaders(page.rows);

  if (!headers.length) return { headers: [], lines: [], nextCursor: page.nextCursor };

  const keys = headers.map((h) => ({
    year: legacyTrim(h.YearID),
    branch: legacyTrim(h.BranchCode),
    gl: padGlNum(h.GlNum ?? h.GLNum),
  }));

  const lines: LegacyJournalLineInput[] = [];
  for (const key of keys) {
    const detail = await adapter.querySql<LegacyJournalLineInput>(
      `SELECT d.*
       FROM dbo.GLTrxDetail d
       WHERE RTRIM(d.CompanyCode)=@cc AND ${LEGACY_POSTED_DETAIL_EXISTS}
         AND RTRIM(d.YearID)=@year AND RTRIM(d.BranchCode)=@branch
         AND RIGHT('00000000'+RTRIM(d.GLNum),8)=@gl
       ORDER BY d.DetailNum, d.AccountNo, d.DebitValue, d.CreditValue, d.IdNum`,
      { cc: companyCode, year: key.year, branch: key.branch, gl: key.gl }
    );
    lines.push(...detail);
  }

  // Page size is judged on the SQL rows, not on the deduped headers: a page that
  // dedupe shrank is not the last page.
  return { headers, lines, nextCursor: page.nextCursor };
}

/** Year|Branch|zero-padded GlNum — the posted-journal identity, used as the keyset cursor. */
export const JOURNAL_HEADER_KEY_SQL = `(RTRIM(ISNULL(h.YearID,''))+'|'+RTRIM(ISNULL(h.BranchCode,''))+'|'+RIGHT('00000000'+RTRIM(ISNULL(h.GlNum,'')),8))`;

export function linesForHeader(
  header: LegacyJournalHeaderInput,
  lines: LegacyJournalLineInput[]
): LegacyJournalLineInput[] {
  const year = legacyTrim(header.YearID);
  const branch = legacyTrim(header.BranchCode);
  const gl = padGlNum(header.GlNum ?? header.GLNum);
  return lines.filter(
    (line) =>
      legacyTrim(line.YearID) === year &&
      legacyTrim(line.BranchCode) === branch &&
      padGlNum(line.GlNum ?? line.GLNum) === gl
  );
}
