export const MASTER_SERIAL_WIDTH = 5;

type NextSerialOptions = {
  width?: number;
  excludeYears?: boolean;
};

function isCountableSerial(raw: string, excludeYears: boolean): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (excludeYears && n >= 1900 && n <= 2100) return null;
  return n;
}

/**
 * Chart-of-accounts style codes: root `1`, `2` … and children `11`, `12` under `1`.
 * Numeric parent codes drop leading zeros so a stored `00001` still yields `11`.
 */
export function nextHierarchicalCode(
  parentCode: string | null | undefined,
  siblingCodes: Array<string | number | null | undefined>
): string {
  const used = new Set(
    siblingCodes.map((value) => String(value ?? '').trim()).filter(Boolean)
  );
  const rawParent = String(parentCode ?? '').trim();

  if (!rawParent) {
    const nums = [...used]
      .filter((code) => /^\d+$/.test(code))
      .map((code) => parseInt(code, 10))
      .filter((n) => !Number.isNaN(n));
    let next = nums.length ? Math.max(...nums) + 1 : 1;
    while (used.has(String(next))) next += 1;
    return String(next);
  }

  const prefix = /^\d+$/.test(rawParent) ? String(parseInt(rawParent, 10)) : rawParent;
  if (used.size === 0) return `${prefix}1`;

  let maxSuffix = 0;
  for (const code of used) {
    if (!code.startsWith(prefix) || code.length <= prefix.length) continue;
    const suffix = code.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n)) maxSuffix = Math.max(maxSuffix, n);
  }

  let candidate = maxSuffix > 0 ? `${prefix}${maxSuffix + 1}` : `${prefix}1`;
  let guard = 0;
  while (used.has(candidate) && guard < 50) {
    const suffix = candidate.slice(prefix.length);
    const n = parseInt(suffix, 10);
    candidate = `${prefix}${Number.isNaN(n) ? maxSuffix + 1 + guard : n + 1}`;
    guard += 1;
  }
  return candidate;
}

/** Next master serial: 00001, 00002, … — empty list always starts at 00001. */
export function nextNumericCode(
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
