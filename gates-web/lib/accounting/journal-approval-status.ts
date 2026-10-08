const APPROVED = 'مؤيد';
const NOT_APPROVED = 'غير مؤيد';

export function journalEntryIsApprovedFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    if (t === 'true' || t === '1' || t === APPROVED) return true;
    if (t === 'false' || t === '0' || t === NOT_APPROVED) return false;
  }
  return false;
}

/** Single source for report cells and column filters (موقف التأييد). */
export function journalApprovalStatusFromRow(row: Record<string, unknown>): string {
  if ('journalEntryIsApproved' in row) {
    return journalEntryIsApprovedFlag(row.journalEntryIsApproved) ? APPROVED : NOT_APPROVED;
  }
  if ('isApproved' in row) {
    return journalEntryIsApprovedFlag(row.isApproved) ? APPROVED : NOT_APPROVED;
  }
  for (const key of ['approvalStatus', 'entryLockStatus', 'supportStatus'] as const) {
    const raw = row[key];
    if (typeof raw === 'string' && raw.trim()) {
      const t = raw.trim();
      if (t === APPROVED || t === NOT_APPROVED) return t;
    }
  }
  return NOT_APPROVED;
}

export const JOURNAL_APPROVAL_COLUMN_IDS = new Set([
  'approvalStatus',
  'entryLockStatus',
  'supportStatus',
]);
