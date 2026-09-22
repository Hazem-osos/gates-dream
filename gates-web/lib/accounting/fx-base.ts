export const FALLBACK_BASE_CURRENCY = 'EGP';
export const POUND_CURRENCY = 'EGP';

export function isEgyptianPound(currencyCode?: string | null): boolean {
  return (currencyCode || POUND_CURRENCY).trim().toUpperCase() === POUND_CURRENCY;
}

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
  if (isEgyptianPound(currencyCode) || isCompanyBaseCurrency(currencyCode, companyBaseCode)) {
    return 1;
  }
  return normalizeFxRate(catalogRate);
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
  headerCurrencyCode: string,
  catalogRate?: number | string | null,
  companyBaseCode?: string | null
): T {
  return {
    ...line,
    currencyCode: headerCurrencyCode,
    exchangeRate: rateForCurrency(headerCurrencyCode, companyBaseCode, catalogRate),
  };
}

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

/** Rate vs company base. Header currency no longer forces 1 — dollar uses its catalog pound rate. */
export function lineFxRate(params: {
  lineCurrencyCode?: string | null;
  headerCurrencyCode?: string | null;
  companyBaseCode?: string | null;
  catalogRate?: number | string | null;
}): number {
  return rateForCurrency(params.lineCurrencyCode, params.companyBaseCode, params.catalogRate);
}

export function isFxRateLocked(
  currencyCode: string | null | undefined,
  companyBaseCode: string | null | undefined
): boolean {
  return !currencyCode || isEgyptianPound(currencyCode) || isCompanyBaseCurrency(currencyCode, companyBaseCode);
}

type JournalLineFxHint = {
  currencyCode?: string | null;
  exchangeRate?: number | string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  debitBase?: number | string | null;
  creditBase?: number | string | null;
};

export function impliedJournalLineRate(line: JournalLineFxHint): number {
  const stored = normalizeFxRate(line.exchangeRate);
  const face = Math.abs(Number(line.debit) || 0) + Math.abs(Number(line.credit) || 0);
  const base = Math.abs(Number(line.debitBase) || 0) + Math.abs(Number(line.creditBase) || 0);
  if (face > 0.0001 && base > 0.0001) {
    const implied = base / face;
    if (Number.isFinite(implied) && implied > 0) return implied;
  }
  return stored;
}

export function resolveJournalLineCurrencyId<T extends { id: string; code?: string | null; exchangeRate?: number | string | null }>(
  line: JournalLineFxHint,
  header: T | undefined,
  currencies: T[],
  companyBase: string
): string | undefined {
  const savedCode = line.currencyCode?.trim();
  if (savedCode) {
    const saved = currencies.find((c) => sameCurrencyCode(c.code, savedCode));
    if (saved) return saved.id;
  }

  const rate = impliedJournalLineRate(line);
  const baseId = pickCurrencyByCode(currencies, companyBase)?.id ?? header?.id;
  if (Math.abs(rate - 1) < 0.0001) return baseId;

  const headerRate = rateForCurrency(header?.code, companyBase, header?.exchangeRate);
  if (header && Math.abs(rate - headerRate) < 0.0001) return header.id;

  const fxCurrencies = currencies.filter(
    (c) => !isEgyptianPound(c.code) && !isCompanyBaseCurrency(c.code, companyBase)
  );
  if (fxCurrencies.length === 0) return baseId;

  let best = fxCurrencies[0];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const currency of fxCurrencies) {
    const catalog = rateForCurrency(currency.code, companyBase, currency.exchangeRate);
    const diff = Math.abs(catalog - rate);
    if (diff < bestDiff) {
      best = currency;
      bestDiff = diff;
    }
  }
  return best.id;
}
