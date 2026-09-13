export { toHijriDate } from '@/lib/hijri-date';

function parseLocalDate(isoDate: string): Date | null {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Gregorian ISO date (`YYYY-MM-DD`) → Hijri display string. */
export function toHijri(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}

/** Hijri medium label from a Gregorian `Date` or ISO `YYYY-MM-DD`. */
export function toHijriMedium(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  if (!d || Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { dateStyle: 'medium' }).format(d);
  } catch {
    return '';
  }
}
