import { Decimal } from '@prisma/client/runtime/library';

export const JOURNAL_BALANCE_TOLERANCE = new Decimal('0.01');

/** Parse a legacy amount as Decimal. Never uses IEEE-754 arithmetic. */
export function money(value: unknown): Decimal {
  if (value == null || value === '') return new Decimal(0);
  if (value instanceof Decimal) return value;
  const raw = String(value).trim().replace(/,/g, '');
  if (!raw || raw === '-' || raw === '.') return new Decimal(0);
  try {
    return new Decimal(raw);
  } catch {
    throw new Error(`Invalid money value: ${String(value)}`);
  }
}

export function money4(value: Decimal): string {
  return value.toDecimalPlaces(4).toFixed(4);
}

export function money2(value: Decimal): string {
  return value.toDecimalPlaces(2).toFixed(2);
}

export function scaleToBase(amount: Decimal, rate: Decimal): Decimal {
  return amount.mul(rate).toDecimalPlaces(4);
}

export function absDiff(a: Decimal, b: Decimal): Decimal {
  return a.sub(b).abs();
}

export function isBalanced(debit: Decimal, credit: Decimal, tolerance = JOURNAL_BALANCE_TOLERANCE): boolean {
  return absDiff(debit, credit).lte(tolerance);
}
