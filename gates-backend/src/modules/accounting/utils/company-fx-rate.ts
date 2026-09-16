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
