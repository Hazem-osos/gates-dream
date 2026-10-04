/** Numeric from/to on invoice numbers stored as padded text (`000015`). */
export function invoiceNumberRange(
  from?: string,
  to?: string
): { start: number; end: number } | null {
  const parse = (value?: string) => {
    const text = value?.trim() ?? '';
    if (!/^\d+$/.test(text)) return null;
    const n = Number(text);
    return Number.isSafeInteger(n) ? n : null;
  };
  const low = parse(from);
  const high = parse(to);
  if (low == null && high == null) return null;
  if (low != null && high == null) return { start: low, end: 999_999_999 };
  if (low == null && high != null) return { start: 0, end: high };
  return { start: Math.min(low!, high!), end: Math.max(low!, high!) };
}
