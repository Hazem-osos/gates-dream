import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';

export const POUND_CURRENCY = 'EGP';

export function asFxRate(value: unknown, fallback = 1): number {
  const rate = Number(value ?? fallback);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

/** الجنيه (وأي عملة أساسية للشركة) سعر صرفها 1 دائماً. */
export function isUnitRateCurrency(
  currencyCode?: string | null,
  companyBaseCode?: string | null
): boolean {
  const code = String(currencyCode || POUND_CURRENCY).trim().toUpperCase() || POUND_CURRENCY;
  if (code === POUND_CURRENCY) return true;
  const base = String(companyBaseCode || '').trim().toUpperCase();
  return Boolean(base) && code === base;
}

export function persistFxRate(
  currencyCode?: string | null,
  rate?: unknown,
  companyBaseCode?: string | null
): number {
  if (isUnitRateCurrency(currencyCode, companyBaseCode)) return 1;
  return asFxRate(rate, 1);
}

/**
 * Mixed journal: header may be EGP while a line is 2 USD at 50.
 * Never flatten that line to 1 just because the header currency is the pound.
 */
export function persistJournalLineFxRate(params: {
  headerCurrencyCode?: string | null;
  lineCurrencyCode?: string | null;
  lineRate?: unknown;
  headerRate?: unknown;
}): number {
  const headerRate = asFxRate(params.headerRate, 1);
  const rate = params.lineRate != null ? asFxRate(params.lineRate, headerRate) : headerRate;
  if (params.lineCurrencyCode) {
    return persistFxRate(params.lineCurrencyCode, rate);
  }
  if (isUnitRateCurrency(params.headerCurrencyCode) && rate !== 1) {
    return rate;
  }
  return persistFxRate(params.headerCurrencyCode, rate);
}

export function persistFxDecimal(
  currencyCode?: string | null,
  rate?: unknown,
  companyBaseCode?: string | null
): Decimal {
  return new Decimal(persistFxRate(currencyCode, rate, companyBaseCode));
}

export async function resolveCompanyFxRate(
  companyId: string,
  currencyCode?: string | null
): Promise<{ currencyCode: string; exchangeRate: number }> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { defaultCurrency: true },
  });
  const base = (settings?.defaultCurrency || POUND_CURRENCY).toUpperCase();
  const code = String(currencyCode || base).trim().toUpperCase() || base;
  if (isUnitRateCurrency(code, base)) {
    return { currencyCode: code, exchangeRate: 1 };
  }

  const currency = await prisma.currency.findFirst({
    where: { companyId, code, isActive: true },
    select: { exchangeRate: true },
  });
  return { currencyCode: code, exchangeRate: persistFxRate(code, currency?.exchangeRate, base) };
}

export function toBaseAmount(amount: number, exchangeRate: number): number {
  return Number(amount || 0) * asFxRate(exchangeRate, 1);
}

/**
 * Foreign currency must not be stored at rate 1 unless the currency card itself is 1.
 * A missing or 1 client rate falls back to the catalog rate (pounds per one unit).
 */
export async function rateForSave(
  companyId: string,
  currencyCode?: string | null,
  clientRate?: unknown
): Promise<number> {
  const resolved = await resolveCompanyFxRate(companyId, currencyCode);
  if (resolved.exchangeRate === 1 && isUnitRateCurrency(resolved.currencyCode)) return 1;
  const client = clientRate == null || clientRate === '' ? null : asFxRate(clientRate, 0);
  if (client && client !== 1) return client;
  return resolved.exchangeRate;
}

export async function loadCurrencyCatalog(companyId: string) {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { defaultCurrency: true },
  });
  const companyBase = (settings?.defaultCurrency || POUND_CURRENCY).toUpperCase();
  const rows = await prisma.currency.findMany({
    where: { companyId, isActive: true },
    select: { code: true, exchangeRate: true, arabicName: true },
  });
  const rates = new Map<string, number>();
  for (const row of rows) {
    const code = row.code.trim().toUpperCase();
    rates.set(code, persistFxRate(code, row.exchangeRate, companyBase));
  }
  rates.set(companyBase, 1);
  rates.set(POUND_CURRENCY, 1);
  return { companyBase, rates };
}

/** Face amount expressed in the report currency. Repairs a foreign amount that was stored as if it were pounds. */
export function moneyInReportCurrency(params: {
  face: number;
  base?: number | null;
  currencyCode?: string | null;
  exchangeRate?: number | null;
  reportCurrency: string;
  companyBase: string;
  catalog: Map<string, number>;
}): number {
  const face = Number(params.face) || 0;
  const code = String(params.currencyCode || params.companyBase).trim().toUpperCase() || params.companyBase;
  const catalogRate = params.catalog.get(code) ?? 1;
  const storedRate = asFxRate(params.exchangeRate, catalogRate);
  const effectiveRate = isUnitRateCurrency(code, params.companyBase)
    ? 1
    : storedRate !== 1
      ? storedRate
      : catalogRate;
  const storedBase = params.base == null ? null : Number(params.base);
  const base =
    storedBase != null &&
    !( !isUnitRateCurrency(code, params.companyBase) && effectiveRate > 1 && Math.abs(storedBase - face) < 0.02 )
      ? storedBase
      : face * effectiveRate;
  const reportCode = params.reportCurrency.trim().toUpperCase();
  const reportRate = isUnitRateCurrency(reportCode, params.companyBase)
    ? 1
    : params.catalog.get(reportCode) || 1;
  return base / reportRate;
}
