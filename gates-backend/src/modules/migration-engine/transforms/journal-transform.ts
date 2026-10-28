import { Decimal } from '@prisma/client/runtime/library';
import { money, money4, scaleToBase } from '../accounting/journal-money';
import { legacyBool, legacyDate, legacyTrim, padGlNum } from './legacy-values';

export interface LegacyJournalHeaderInput {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  GlNum?: unknown;
  GLNum?: unknown;
  Date?: unknown;
  DateH?: unknown;
  DescA?: unknown;
  DescE?: unknown;
  CurrencyCode?: unknown;
  Change?: unknown;
  Status?: unknown;
  Deleted?: unknown;
  Type?: unknown;
  SourceNum?: unknown;
  GLInvoiceType?: unknown;
  UserCode?: unknown;
  Balanced?: unknown;
}

export interface LegacyJournalLineInput {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  GlNum?: unknown;
  GLNum?: unknown;
  DetailNum?: unknown;
  LineNum?: unknown;
  IdNum?: unknown;
  AccountNo?: unknown;
  AccountCode?: unknown;
  DebitValue?: unknown;
  Debit?: unknown;
  CreditValue?: unknown;
  Credit?: unknown;
  Change?: unknown;
  DetailDescA?: unknown;
  DetailDescE?: unknown;
  DescA?: unknown;
  Description?: unknown;
  CCenterCode?: unknown;
  CurrencyCode?: unknown;
}

export interface TransformedJournalHeader {
  companyId: string;
  branchId: string | null;
  fiscalYearId: string | null;
  legacyGlNum: string;
  date: Date;
  hijriDate: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  description: string | null;
  currencyCode: string;
  exchangeRate: Decimal;
  postingStatus: string;
  isPosted: boolean;
  isBalanced: boolean;
  isCancelled: boolean;
  deletedAt: Date | null;
  sourceType: string | null;
  sourceNumber: string | null;
  sourceYearId: string | null;
  sourceKind: 'MANUAL';
  entryType: string;
  workflowStatus: string;
  createdBy: string;
}

export interface TransformedJournalLine {
  lineNumber: number;
  lineOrder: number;
  accountCode: string;
  costCenterCode: string;
  description: string | null;
  debit: Decimal;
  credit: Decimal;
  exchangeRate: Decimal;
  debitBase: Decimal;
  creditBase: Decimal;
  currencyCode: string | null;
}

export function journalSourceKey(params: {
  companyCode: string;
  branchCode: string;
  yearId: string;
  glNum: string;
}): Record<string, string> {
  return {
    companyCode: params.companyCode,
    branchCode: params.branchCode,
    yearId: params.yearId,
    glNum: params.glNum,
  };
}

export function transformHistoricalJournalHeader(
  row: LegacyJournalHeaderInput,
  ids: { companyId: string; branchId?: string | null; fiscalYearId?: string | null }
): TransformedJournalHeader {
  const glNum = padGlNum(row.GlNum ?? row.GLNum);
  const status = legacyTrim(row.Status);
  const isPosted = status.toLowerCase() === 'post';
  const isCancelled = legacyBool(row.Deleted, false);
  const descriptionAr = legacyTrim(row.DescA) || null;
  const descriptionEn = legacyTrim(row.DescE) || null;
  return {
    companyId: ids.companyId,
    branchId: ids.branchId ?? null,
    fiscalYearId: ids.fiscalYearId ?? null,
    legacyGlNum: glNum,
    date: legacyDate(row.Date) ?? new Date(0),
    hijriDate: legacyTrim(row.DateH) || null,
    descriptionAr,
    descriptionEn,
    description: descriptionAr || descriptionEn,
    currencyCode: legacyTrim(row.CurrencyCode) || 'EGP',
    exchangeRate: money(row.Change ?? 1),
    postingStatus: isPosted ? 'Post' : 'UnPost',
    isPosted,
    isBalanced: legacyBool(row.Balanced, true),
    isCancelled,
    deletedAt: isCancelled ? new Date(0) : null,
    sourceType: legacyTrim(row.Type) || null,
    sourceNumber: legacyTrim(row.SourceNum) || null,
    sourceYearId: legacyTrim(row.YearID) || null,
    sourceKind: 'MANUAL',
    entryType: legacyTrim(row.GLInvoiceType) || 'LEGACY_GL',
    workflowStatus: isPosted ? 'POSTED' : 'DRAFT',
    createdBy: 'legacy-historical-import',
  };
}

export function transformHistoricalJournalLine(row: LegacyJournalLineInput): TransformedJournalLine {
  const lineNumber = Number.parseInt(String(row.DetailNum ?? row.LineNum ?? row.IdNum ?? '1'), 10);
  const debit = money(row.DebitValue ?? row.Debit);
  const credit = money(row.CreditValue ?? row.Credit);
  const rate = money(row.Change ?? 1);
  const safeLine = Number.isFinite(lineNumber) ? lineNumber : 1;
  return {
    lineNumber: safeLine,
    lineOrder: safeLine,
    accountCode: legacyTrim(row.AccountNo ?? row.AccountCode),
    costCenterCode: legacyTrim(row.CCenterCode),
    description: legacyTrim(row.DetailDescA ?? row.DescA ?? row.Description) || null,
    debit,
    credit,
    exchangeRate: rate,
    debitBase: scaleToBase(debit, rate),
    creditBase: scaleToBase(credit, rate),
    currencyCode: legacyTrim(row.CurrencyCode) || null,
  };
}

/** Target lineNumber must be unique per journal. Legacy DetailNum can repeat. */
export function assignUniqueLineNumbers(lines: TransformedJournalLine[]): TransformedJournalLine[] {
  const seen = new Set<number>();
  let unique = true;
  for (const line of lines) {
    if (seen.has(line.lineNumber)) {
      unique = false;
      break;
    }
    seen.add(line.lineNumber);
  }
  if (unique) return lines;
  return lines.map((line, index) => ({
    ...line,
    lineNumber: index + 1,
    lineOrder: index + 1,
  }));
}

export function lineWritePayload(
  line: TransformedJournalLine,
  journalEntryId: string,
  accountId: string,
  costCenterId: string | null
) {
  return {
    journalEntryId,
    lineNumber: line.lineNumber,
    lineOrder: line.lineOrder,
    accountId,
    costCenterId,
    description: line.description,
    debit: money4(line.debit),
    credit: money4(line.credit),
    exchangeRate: line.exchangeRate.toDecimalPlaces(6).toFixed(6),
    debitBase: money4(line.debitBase),
    creditBase: money4(line.creditBase),
    currencyCode: line.currencyCode,
  };
}
