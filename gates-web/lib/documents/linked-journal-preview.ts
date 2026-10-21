const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isJournalEntryId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

/** Companion journal stays on the document after unpost and cancel. */
export function resolveLinkedJournalId(
  journalEntryId?: string | null,
  sourceRows?: Array<{ id?: string | null }> | null
): string | null {
  if (isJournalEntryId(journalEntryId)) return journalEntryId;
  const fromSource = sourceRows?.find((row) => isJournalEntryId(row.id))?.id;
  return fromSource ?? null;
}

export const LINKED_JOURNAL_EMPTY_SAVED =
  'يظهر القيد هنا بعد أول ترحيل، ويبقى ظاهراً بعد فك الترحيل أو الإلغاء.';

export const LINKED_JOURNAL_EMPTY_UNSAVED = 'احفظ المستند أولاً لعرض القيد المحاسبي.';
