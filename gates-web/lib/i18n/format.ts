import type { AppLocale } from './types';

export function intlLocale(locale: AppLocale): string {
  return locale === 'ar' ? 'ar-EG' : 'en-GB';
}

export function formatLocaleNumber(
  value: number | string | null | undefined,
  locale: AppLocale,
  options?: Intl.NumberFormatOptions,
  fallback = '—'
): string {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'string' ? Number(String(value).replace(/,/g, '')) : value;
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString(intlLocale(locale), options);
}

export function formatLocaleMoney(
  value: number | string | null | undefined,
  locale: AppLocale,
  currency?: string | null,
  fallback = '—'
): string {
  if (currency) {
    return formatLocaleNumber(
      value,
      locale,
      {
        style: 'currency',
        currency,
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      },
      fallback
    );
  }
  return formatLocaleNumber(
    value,
    locale,
    { minimumFractionDigits: 4, maximumFractionDigits: 4 },
    fallback
  );
}

export function formatLocaleDate(
  value: string | number | Date | null | undefined,
  locale: AppLocale,
  fallback = '—'
): string {
  if (value == null || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
