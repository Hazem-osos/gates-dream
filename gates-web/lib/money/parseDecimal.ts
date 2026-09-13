/**
 * Wave 5 fix: Prisma `Decimal` fields (netAmount, remainingAmount, unitPrice,
 * exchangeRate, quantity, ...) serialize over the API as strings, e.g.
 * `"1234.5000"`. Call sites across the app parsed these ad hoc with
 * `Number(x)`, `parseFloat(x)`, or `+x`, each with slightly different
 * null/empty/comma handling. This is the single parser everyone should use
 * for a Decimal-as-string (or already-numeric) field coming off the API.
 */
export function parseDecimal(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const str = String(value).trim();
  if (str === '') return fallback;
  const normalized = str.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Delphi RoundTo(value, -4) equivalent — mirrors the backend's
 * `roundTo4` in `gates-backend/src/shared/utils/decimal-round.ts`, since the
 * M5 invoice/GL stack posts and validates at 4 decimal places
 * (`@db.Decimal(18, 4)`). Use this for *computed* money math (invoice
 * previews, allocation totals) so client-side arithmetic doesn't drift from
 * what the server will actually store. Use `roundMoney2` only for on-screen
 * display formatting.
 */
export function roundTo4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** EGP-style on-screen display rounding — 2 decimal places. Display only; never feed the result back into further arithmetic. */
export function roundMoney2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function amountsEqualAt4(a: number, b: number): boolean {
  return roundTo4(a) === roundTo4(b);
}
