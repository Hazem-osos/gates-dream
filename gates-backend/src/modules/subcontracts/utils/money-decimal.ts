import { Decimal } from '@prisma/client/runtime/library';

/** Stored money scale — matches `@db.Decimal(18, 4)`. */
export const MONEY_SCALE = 4;
/** Stored rate scale — matches `@db.Decimal(8, 6)`. */
export const RATE_SCALE = 6;

const HALF_UP = Decimal.ROUND_HALF_UP ?? 4;

export type DecimalInput = Decimal.Value;

export function toDecimal(value: DecimalInput): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function money(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(MONEY_SCALE, HALF_UP);
}

export function rate(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(RATE_SCALE, HALF_UP);
}

export function moneyZero(): Decimal {
  return money(0);
}

export function moneyMin(a: Decimal, b: Decimal): Decimal {
  return a.lte(b) ? a : b;
}

export function moneyMax(a: Decimal, b: Decimal): Decimal {
  return a.gte(b) ? a : b;
}

export function sumMoney(values: Iterable<DecimalInput>): Decimal {
  let acc = moneyZero();
  for (const value of values) {
    acc = money(acc.plus(toDecimal(value)));
  }
  return acc;
}
