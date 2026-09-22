const SAFE_MATH = /^[\d+\-*/().\s]+$/;
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

/** Eastern Arabic digits + Arabic/European decimals → ASCII so ١٫٥ and 1,5 type as 1.5. */
export function normalizeNumericDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EXTENDED_ARABIC.indexOf(digit)))
    .replace(/[٫]/g, '.')
    .replace(/,/g, '.');
}

/** Evaluate simple expressions (e.g. 24*3, 100-15, 114/1.14). Returns null if invalid. */
export function evaluateMathExpression(raw: string): number | null {
  const trimmed = normalizeNumericDigits(raw).trim();
  if (!trimmed) return null;

  const loose = trimmed.replace(/\.$/, '');
  if (/^\d+(\.\d+)?$/.test(loose)) {
    const n = Number(loose);
    return Number.isFinite(n) ? n : null;
  }

  if (!SAFE_MATH.test(trimmed)) return null;

  try {
    const fn = new Function(`"use strict"; return (${trimmed});`);
    const result = fn();
    if (typeof result !== 'number' || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

/** Keep digits/math; drop letters. Intermediate values like `1.` stay so 1.5 can be typed. */
export function sanitizeMathInput(raw: string): string {
  return normalizeNumericDigits(raw).replace(/[^\d+\-*/().\s]/g, '');
}

export function formatGridNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  });
}
