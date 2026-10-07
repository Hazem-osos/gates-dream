/** Date-only semantics for HR effective dating (UTC calendar day). */
export function toDateOnly(value: Date | string): Date {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isSameDateOnly(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function isBeforeDateOnly(a: Date, b: Date): boolean {
  return toDateOnly(a).getTime() < toDateOnly(b).getTime();
}

export function isAfterDateOnly(a: Date, b: Date): boolean {
  return toDateOnly(a).getTime() > toDateOnly(b).getTime();
}

/** Inclusive range: effectiveFrom <= day <= effectiveTo (null effectiveTo = open). */
export function isDateInEffectiveRange(
  day: Date,
  effectiveFrom: Date,
  effectiveTo: Date | null | undefined
): boolean {
  const d = toDateOnly(day);
  const from = toDateOnly(effectiveFrom);
  if (d.getTime() < from.getTime()) return false;
  if (!effectiveTo) return true;
  const to = toDateOnly(effectiveTo);
  return d.getTime() <= to.getTime();
}

/** True if [aFrom,aTo] overlaps [bFrom,bTo] (open-ended to = infinity). */
export function rangesOverlap(
  aFrom: Date,
  aTo: Date | null | undefined,
  bFrom: Date,
  bTo: Date | null | undefined
): boolean {
  const aEnd = aTo ? toDateOnly(aTo).getTime() : Number.POSITIVE_INFINITY;
  const bEnd = bTo ? toDateOnly(bTo).getTime() : Number.POSITIVE_INFINITY;
  const aStart = toDateOnly(aFrom).getTime();
  const bStart = toDateOnly(bFrom).getTime();
  return aStart <= bEnd && bStart <= aEnd;
}

/** Day before `date` (UTC). */
export function previousDateOnly(date: Date): Date {
  const d = toDateOnly(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
