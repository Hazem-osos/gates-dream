import { roundTo2 } from '../utils/pos-money';

export type CouponRule = {
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
  minSpend: number;
  kind: 'PERCENT' | 'AMOUNT';
  percent: number | null;
  amount: number | null;
  maxUses: number | null;
  usedCount: number;
  customerId: string | null;
  singleUsePerCustomer: boolean;
};

export type DenominationLine = { value: number; count: number };

/** Face value in a foreign currency becomes the EGP amount the journal and drawer use. */
export function functionalTender(currencyCode: string, faceAmount: number, exchangeRate: number) {
  const currency = currencyCode.trim().toUpperCase() || 'EGP';
  if (currency === 'EGP') {
    return { currency, exchangeRate: 1, foreignAmount: null as number | null, functionalAmount: roundTo2(faceAmount) };
  }
  if (!(exchangeRate > 0)) {
    throw new Error('Exchange rate is not configured');
  }
  return {
    currency,
    exchangeRate,
    foreignAmount: roundTo2(faceAmount),
    functionalAmount: roundTo2(faceAmount * exchangeRate),
  };
}

export function couponDiscount(rule: CouponRule, merchandise: number, customerId: string | null, alreadyUsedByCustomer: boolean, now = new Date()) {
  if (!rule.isActive) return { ok: false as const, reason: 'Coupon is not active' };
  if (now < rule.validFrom || now > rule.validTo) return { ok: false as const, reason: 'Coupon is outside its validity' };
  if (rule.maxUses != null && rule.usedCount >= rule.maxUses) return { ok: false as const, reason: 'Coupon has no uses left' };
  if (rule.customerId && rule.customerId !== customerId) return { ok: false as const, reason: 'Coupon is restricted to another customer' };
  if (rule.singleUsePerCustomer && alreadyUsedByCustomer) return { ok: false as const, reason: 'Coupon was already used by this customer' };
  if (merchandise + 0.001 < rule.minSpend) return { ok: false as const, reason: 'Coupon minimum spend is not met' };
  const discount = rule.kind === 'PERCENT'
    ? roundTo2(merchandise * Number(rule.percent ?? 0) / 100)
    : roundTo2(Math.min(Number(rule.amount ?? 0), merchandise));
  if (!(discount > 0)) return { ok: false as const, reason: 'Coupon does not reduce the total' };
  return { ok: true as const, discount };
}

/** The shared amount is an exchange clearing leg. Only the difference is cash in or cash out. */
export function exchangeSplit(returnNet: number, saleNet: number) {
  const offset = roundTo2(Math.min(Math.max(returnNet, 0), Math.max(saleNet, 0)));
  const difference = roundTo2(saleNet - returnNet);
  return {
    offset,
    collect: difference > 0 ? difference : 0,
    refund: difference < 0 ? roundTo2(-difference) : 0,
  };
}

export function countedFromDenominations(lines: DenominationLine[]) {
  if (!lines.length) throw new Error('Denomination lines are required');
  let total = 0;
  for (const line of lines) {
    if (!(line.value > 0) || !Number.isInteger(line.count) || line.count < 0) {
      throw new Error('Each denomination needs a positive value and a whole count');
    }
    total = roundTo2(total + line.value * line.count);
  }
  return total;
}
