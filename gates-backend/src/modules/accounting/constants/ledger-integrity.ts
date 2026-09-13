/** Shared ledger integrity messages (Phase 1 C6 / C11 / M2 / M3). */

export const PERIOD_LOCKED_MESSAGE = 'لا يمكن الترحيل في فترة مالية مقفلة';

/**
 * Legacy `Tgeneral.GetPeriod` (`MainProgram/untgeneral.pas` 5290-5314) resolves a date to
 * a `YearCode`, `'0'` (no year covers the date), or `'Close'` (year found but closed) and
 * every caller shows one of these two exact `LangMessages` rows for the non-open cases.
 */
export const NO_FISCAL_YEAR_FOR_DATE_MESSAGE =
  'التاريخ المحدد لا يقع ضمن فترة محاسبية محددة'; // LangMessages 1123
export const FISCAL_YEAR_CLOSED_FOR_DATE_MESSAGE =
  'التاريخ المحدد يقع ضمن فترة محاسبية مغلقة'; // LangMessages 1124

export const VAT_ACCOUNT_UNMAPPED_MESSAGE =
  'حساب الضريبة غير مربوط في إعدادات الشركة';

/**
 * `CompanySettings.lockPostingBeforeDate` — persisted since it was added to
 * the settings CRUD but never checked by any posting path (Phase 1 foundation
 * flag-wiring). No document dated earlier than this cutoff may be posted.
 */
export const POSTING_LOCKED_BEFORE_DATE_MESSAGE =
  'لا يمكن الترحيل في تاريخ أقدم من تاريخ قفل الترحيل المحدد في إعدادات الشركة';

export function journalReversalDescription(
  originalNumber: string,
  reason?: string
): string {
  const base = `قيد عكسي للقيد رقم ${originalNumber}`;
  const trimmed = reason?.trim();
  return trimmed ? `${base} - ${trimmed}` : base;
}
