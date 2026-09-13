/**
 * Automatically converts any Gregorian date to a formatted Hijri date string
 * using the Islamic Umm al-Qura calendar standard.
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

    return `${formatter.format(gDate)} هـ`;
  } catch (error) {
    console.error('Hijri conversion error:', error);
    return '';
  }
}
