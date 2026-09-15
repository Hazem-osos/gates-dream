export function nextNumericCode(values: Array<string | number | null | undefined>): string {
  let max = 0;
  for (const value of values) {
    const n = Number(String(value ?? '').trim());
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

export function advancedFlag(
  advanced: unknown,
  key: string,
  defaultTrue = true
): boolean {
  const record =
    advanced && typeof advanced === 'object' ? (advanced as Record<string, unknown>) : {};
  if (defaultTrue) return record[key] !== false;
  return record[key] === true;
}
