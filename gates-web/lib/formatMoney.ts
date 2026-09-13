/** Arabic-locale money display; use instead of hard-coded demo amounts (e.g. 25,4456). */
export function formatMoneyAr(
  value: number | string | null | undefined,
  fallback = '—'
): string {
  if (value == null || value === '') return fallback;
  const n =
    typeof value === 'string'
      ? Number(String(value).replace(/,/g, ''))
      : value;
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
