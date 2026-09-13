const SAFE_MATH = /^[\d+\-*/().\s,]+$/;

/** Evaluate simple expressions (e.g. 24*3, 100-15, 114/1.14). Returns null if invalid. */
export function evaluateMathExpression(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  if (!SAFE_MATH.test(trimmed)) return null;

  try {
    const fn = new Function(`"use strict"; return (${normalized});`);
    const result = fn();
    if (typeof result !== 'number' || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

export function sanitizeMathInput(raw: string): string {
  return raw.replace(/[^\d+\-*/().,\s]/g, '');
}

export function formatGridNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  });
}
