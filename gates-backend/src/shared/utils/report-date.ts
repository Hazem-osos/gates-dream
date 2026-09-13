/**
 * M15 fix — shared date-only parsing for report filters.
 *
 * A plain `new Date('YYYY-MM-DD')` is parsed by the JS engine as UTC
 * midnight, which is correct per ISO 8601. The actual bug was never the
 * parse itself — it's that (a) an *end*-of-range date-only string is
 * treated as the exact instant of UTC midnight, silently excluding every
 * journal entry recorded later that same calendar day, and (b) frontend
 * "today" defaults were built from `new Date().toISOString().split('T')[0]`,
 * which floors to the *UTC* calendar day rather than the user's local one —
 * a user east of UTC past midnight local time still gets "yesterday".
 *
 * These helpers give every report route/service the same, explicit
 * contract: `startOfDayUtc` for range starts, `endOfDayUtc` for range ends
 * (so a same-day filter actually includes the whole day), regardless of
 * which tier (frontend default, query string, queued-export filters)
 * produced the string.
 */

export function parseDateOnly(value: unknown, field: string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`Invalid ${field}`);
    return value;
  }
  if (!value || typeof value !== 'string') {
    throw new Error(`${field} is required (ISO date)`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}`);
  return d;
}

/** Normalizes a date-only value to UTC midnight (start of that calendar day). */
export function startOfDayUtc(value: unknown, field: string): Date {
  const d = parseDateOnly(value, field);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Normalizes a date-only value to the last instant of that UTC calendar
 * day, so range filters like `endDate <= value` include everything posted
 * on that day instead of only entries at exactly 00:00:00.
 */
export function endOfDayUtc(value: unknown, field: string): Date {
  const d = parseDateOnly(value, field);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  );
}
