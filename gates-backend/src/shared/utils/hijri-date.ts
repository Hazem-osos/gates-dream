/**
 * Converts any Gregorian date to a formatted Hijri string using the
 * Islamic Umm al-Qura calendar (`ar-SA-u-ca-islamic-umalqura`).
 */
export function toHijriDate(date: Date | string | number): string {
  try {
    let gDate: Date;
    if (typeof date === 'string') {
      gDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(`${date}T00:00:00`)
        : new Date(date);
    } else if (typeof date === 'number') {
      gDate = new Date(date);
    } else {
      gDate = date;
    }
    if (Number.isNaN(gDate.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const formatted = formatter.format(gDate).replace(/\s*هـ+\s*$/u, '').trim();
    return formatted ? `${formatted} هـ` : '';
  } catch {
    return '';
  }
}

/** Prefer an explicit Hijri string; otherwise compute from the Gregorian date. */
export function resolveHijriDate(
  date: Date | string | number | null | undefined,
  explicit?: string | null
): string | undefined {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  if (date == null) return undefined;
  return toHijriDate(date) || undefined;
}
