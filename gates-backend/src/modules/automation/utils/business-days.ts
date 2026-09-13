/** Egypt banking weekend: Friday + Saturday. */
const WEEKEND_UTC_DAYS = new Set([5, 6]);

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isUtcWeekend(date: Date): boolean {
  return WEEKEND_UTC_DAYS.has(date.getUTCDay());
}

export function addUtcBusinessDays(from: Date, businessDays: number): Date {
  const cursor = startOfUtcDay(from);
  let remaining = businessDays;
  const step = remaining >= 0 ? 1 : -1;
  remaining = Math.abs(remaining);
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    if (!isUtcWeekend(cursor)) remaining -= 1;
  }
  return cursor;
}

export function utcBusinessDaysBetween(from: Date, to: Date): number {
  const start = startOfUtcDay(from);
  const end = startOfUtcDay(to);
  if (end <= start) return 0;
  let days = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isUtcWeekend(cursor)) days += 1;
  }
  return days;
}
