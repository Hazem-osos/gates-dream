export const FALLBACK_BASE_CURRENCY = 'EGP';

export function currencyDisplayLabel(code: string | null | undefined): string {
  const normalized = (code || FALLBACK_BASE_CURRENCY).trim().toUpperCase();
  return normalized === 'EGP' ? 'ج.م' : normalized;
}

export function normalizeFxRate(rate?: number | string | null): number {
  const n = Number(rate ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function toBaseAmount(amount?: number | string | null, rate?: number | string | null): number {
  return (Number(amount) || 0) * normalizeFxRate(rate);
}

export function formatBaseAmount(amount: number): string {
  if (!amount) return '';
  return amount.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function isCompanyBaseCurrency(
  currencyCode: string | null | undefined,
  companyBaseCode: string | null | undefined
): boolean {
  const a = (currencyCode || '').trim().toUpperCase();
  const b = (companyBaseCode || FALLBACK_BASE_CURRENCY).trim().toUpperCase();
  return Boolean(a) && a === b;
}

export function pickCurrencyByCode<T extends { code?: string | null }>(
  currencies: T[],
  companyBaseCode: string | null | undefined
): T | undefined {
  if (!currencies.length) return undefined;
  const base = (companyBaseCode || FALLBACK_BASE_CURRENCY).trim().toUpperCase();
  return currencies.find((c) => (c.code || '').trim().toUpperCase() === base) ?? currencies[0];
}

export function rateForCurrency(
  currencyCode: string | null | undefined,
  companyBaseCode: string | null | undefined,
  catalogRate?: number | string | null
): number {
  return isCompanyBaseCurrency(currencyCode, companyBaseCode) ? 1 : normalizeFxRate(catalogRate);
}

export function sameCurrencyCode(
  left?: string | null,
  right?: string | null
): boolean {
  const a = (left || '').trim().toUpperCase();
  const b = (right || '').trim().toUpperCase();
  return Boolean(a) && a === b;
}

export function withHeaderCurrency<T extends { currencyCode?: string; exchangeRate?: number }>(
  line: T,
  headerCurrencyCode: string
): T {
  return {
    ...line,
    currencyCode: headerCurrencyCode,
    exchangeRate: 1,
  };
}

/** Line FX: 1 when it matches the header or company base; otherwise the catalog rate. */
/** Safe/bank `balance` is stored in company base. Show it in the document currency. */
export function treasuryBalanceInCurrency(
  storedBase?: number | string | null,
  headerFxRate?: number | string | null
): number {
  const base = Number(storedBase ?? 0);
  if (!Number.isFinite(base)) return 0;
  const rate = normalizeFxRate(headerFxRate);
  return base / rate;
}

export function lineFxRate(params: {
  lineCurrencyCode?: string | null;
  headerCurrencyCode?: string | null;
  companyBaseCode?: string | null;
  catalogRate?: number | string | null;
}): number {
  const line = (params.lineCurrencyCode || '').trim().toUpperCase();
  if (!line) return 1;
  if (sameCurrencyCode(line, params.headerCurrencyCode)) return 1;
  return rateForCurrency(line, params.companyBaseCode, params.catalogRate);
}
