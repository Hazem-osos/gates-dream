import { formatLocaleMoney } from '@/lib/i18n/format';
import type { AppLocale } from '@/lib/i18n/types';

/** Locale-aware money display. Does not assume EGP. */
export function formatMoneyAr(
  value: number | string | null | undefined,
  fallback = '—',
  locale: AppLocale = 'ar'
): string {
  return formatLocaleMoney(value, locale, undefined, fallback);
}
