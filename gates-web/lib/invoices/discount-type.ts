export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const VAT_LABEL_AR = 'ضريبة القيمة المضافة (ض.ق.م)';

export function parseDiscountType(value: unknown): DiscountType {
  return value === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
}

export function resolveDiscountValue(line: {
  discountValue?: number | null;
  discount?: number | null;
}): number {
  const raw = line.discountValue ?? line.discount ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function resolveLineDiscountAmount(
  itemSubtotal: number,
  discountType: DiscountType | string | undefined,
  discountValue: number | undefined
): number {
  const value = Number(discountValue) || 0;
  if (value <= 0 || itemSubtotal <= 0) return 0;
  if (parseDiscountType(discountType) === 'FIXED') {
    return Math.min(value, itemSubtotal);
  }
  const pct = Math.min(Math.max(value, 0), 100);
  return (itemSubtotal * pct) / 100;
}

export function inferDiscountTypeFromApi(line: {
  discountPercent?: unknown;
  discountAmount?: unknown;
}): DiscountType {
  const pct = Number(line.discountPercent ?? 0);
  if (Number.isFinite(pct) && pct > 0) return 'PERCENTAGE';
  const amt = Number(line.discountAmount ?? 0);
  if (Number.isFinite(amt) && amt > 0) return 'FIXED';
  return 'PERCENTAGE';
}

export function inferDiscountValueFromApi(line: {
  discountPercent?: unknown;
  discountAmount?: unknown;
  discount?: unknown;
}): number {
  if (inferDiscountTypeFromApi(line) === 'FIXED') {
    const amt = Number(line.discountAmount ?? 0);
    return Number.isFinite(amt) && amt > 0 ? amt : 0;
  }
  const pct = Number(line.discountPercent ?? line.discount ?? 0);
  return Number.isFinite(pct) && pct > 0 ? pct : 0;
}

export function mapDiscountToM5Payload(line: {
  discountType?: DiscountType | string;
  discountValue?: number;
  discount?: number;
}): { discountPercent?: number; discountAmount?: number } {
  const value = resolveDiscountValue(line);
  if (parseDiscountType(line.discountType) === 'FIXED') {
    return value > 0 ? { discountAmount: value } : {};
  }
  return value > 0 ? { discountPercent: value } : {};
}
