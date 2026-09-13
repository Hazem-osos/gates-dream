/**
 * Delphi RoundTo(value, -4) equivalent — round to 4 decimal places.
 */
export function roundTo4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function amountsEqualAt4(a: number, b: number): boolean {
  return roundTo4(a) === roundTo4(b);
}
