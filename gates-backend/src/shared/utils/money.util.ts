import { Decimal } from '@prisma/client/runtime/library';
import { amountsEqualAt4, roundTo4 } from './decimal-round';

const SCALE = 4;

export type MoneyLineInput = {
  debit: number;
  credit: number;
  exchangeRate?: number;
};

/** Round a numeric amount to 4 decimal places (Delphi RoundTo -4). */
export function toMoney4(value: number | Decimal): number {
  const n = value instanceof Decimal ? value.toNumber() : value;
  return roundTo4(n);
}

/** Base currency amount for one line: amount * rate, rounded to 4 dp. */
export function lineBaseAmount(amount: number, exchangeRate = 1): number {
  return toMoney4(new Decimal(amount).mul(exchangeRate));
}

export function lineDebitBase(debit: number, exchangeRate = 1): number {
  return lineBaseAmount(debit, exchangeRate);
}

export function lineCreditBase(credit: number, exchangeRate = 1): number {
  return lineBaseAmount(credit, exchangeRate);
}

export function sumBaseLines(lines: MoneyLineInput[]): {
  debitBase: number;
  creditBase: number;
} {
  let debitBase = 0;
  let creditBase = 0;
  for (const line of lines) {
    const rate = line.exchangeRate ?? 1;
    debitBase = toMoney4(debitBase + lineBaseAmount(line.debit, rate));
    creditBase = toMoney4(creditBase + lineBaseAmount(line.credit, rate));
  }
  return { debitBase, creditBase };
}

export function assertBalancedAt4(
  lines: MoneyLineInput[],
  message = 'Journal entry is not balanced at 4 decimals'
): { isBalanced: boolean; debitBase: number; creditBase: number } {
  const { debitBase, creditBase } = sumBaseLines(lines);
  const isBalanced = amountsEqualAt4(debitBase, creditBase);
  if (!isBalanced) {
    const err = new Error(`${message} (debit ${debitBase}, credit ${creditBase})`);
    (err as Error & { statusCode?: number }).statusCode = 422;
    throw err;
  }
  return { isBalanced, debitBase, creditBase };
}

export function toDecimal4(value: number | Decimal): Decimal {
  const n = toMoney4(value);
  return new Decimal(n.toFixed(SCALE));
}

export function mulToDecimal4(amount: number | Decimal, rate: number | Decimal): Decimal {
  const product = new Decimal(amount).mul(rate);
  return toDecimal4(product);
}

/** Each line must have amount on exactly one side (debit XOR credit); negatives allowed for reversals. */
export function validateJournalLineSides(lines: MoneyLineInput[]): void {
  for (let i = 0; i < lines.length; i++) {
    const d = lines[i].debit;
    const c = lines[i].credit;
    const hasDebit = d !== 0;
    const hasCredit = c !== 0;
    if (hasDebit && hasCredit) {
      throw new Error(`Journal line ${i + 1}: debit and credit cannot both be non-zero`);
    }
    if (!hasDebit && !hasCredit) {
      throw new Error(`Journal line ${i + 1}: debit or credit must be non-zero`);
    }
  }
}
