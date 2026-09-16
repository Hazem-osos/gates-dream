export const MASTER_SERIAL_WIDTH = 5;

type NextSerialOptions = {
  width?: number;
  /** Skip year-like codes (1990–2100) so leftover FY ids do not jump the serial. */
  excludeYears?: boolean;
};

function isCountableSerial(raw: string, excludeYears: boolean): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (excludeYears && n >= 1900 && n <= 2100) return null;
  return n;
}

/** Next master serial: 00001, 00002, … — empty list always starts at 00001. */
export function nextNumericSerial(
  values: Array<string | number | null | undefined>,
  options: NextSerialOptions = {}
): string {
  const width = options.width ?? MASTER_SERIAL_WIDTH;
  const excludeYears = options.excludeYears === true;
  let max = 0;
  const used = new Set<string>();

  for (const value of values) {
    const raw = String(value ?? '').trim();
    if (!raw) continue;
    used.add(raw);
    const n = isCountableSerial(raw, excludeYears);
    if (n != null && n > max) max = n;
  }

  let next = max + 1;
  let serial = String(next).padStart(width, '0');
  while (used.has(serial) || used.has(String(Number(serial)))) {
    next += 1;
    serial = String(next).padStart(width, '0');
  }
  return serial;
}

/** Increment trailing digits: 1110002 → 1110003. Empty if the value has no trailing number. */
export function bumpTrailingCode(code: string): string {
  const trimmed = code.trim();
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return '';
  const width = match[2].length;
  return `${match[1]}${String(Number(match[2]) + 1).padStart(width, '0')}`;
}

/** True when `candidate` is a later sibling of `baseline` (same prefix, higher trailing number). */
export function isCodeAfter(candidate: string, baseline: string): boolean {
  const left = candidate.trim().match(/^(.*?)(\d+)$/);
  const right = baseline.trim().match(/^(.*?)(\d+)$/);
  if (!left || !right || left[1] !== right[1]) return false;
  return Number(left[2]) > Number(right[2]);
}
