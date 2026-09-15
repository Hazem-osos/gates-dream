export function nextNumericSerial(values: Array<string | number | null | undefined>): string {
  let max = 0;
  for (const value of values) {
    const n = Number(String(value ?? '').trim());
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}
