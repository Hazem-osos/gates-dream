import { formatLocaleNumber } from '@/lib/i18n/format';

/** Quantities (on-hand, in/out, movement) — not currency. */
export function formatWarehouseQty(value: number | string | null | undefined, fallback = '—'): string {
  return formatLocaleNumber(
    value,
    'ar',
    { minimumFractionDigits: 0, maximumFractionDigits: 4 },
    fallback
  );
}

/** Integer counts (alerts, days, item counts). */
export function formatWarehouseCount(value: number | string | null | undefined, fallback = '0'): string {
  return formatLocaleNumber(value, 'ar', { maximumFractionDigits: 0 }, fallback);
}
