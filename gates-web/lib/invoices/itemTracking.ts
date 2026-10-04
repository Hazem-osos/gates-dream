export type TrackedItemLike = {
  useExpirationDate?: boolean | null;
  useSerialNumber?: boolean | null;
  hasExpiry?: boolean | null;
  trackingType?: string | null;
  clothingItem?: boolean | null;
  color?: string | null;
  size?: string | null;
  colorId?: string | null;
};

export function itemIsBatchTracked(item?: TrackedItemLike | null) {
  if (!item) return false;
  const type = String(item.trackingType || '').toUpperCase();
  return Boolean(
    item.hasExpiry ||
      item.useExpirationDate ||
      item.useSerialNumber ||
      type === 'BATCH' ||
      type === 'LOT'
  );
}

export function itemHasApparelVariants(item?: TrackedItemLike | null) {
  if (!item) return false;
  return Boolean(item.clothingItem || item.color || item.size || item.colorId);
}

/** Settings store 0.01 for 1%. Invoice lines store 1 for 1%. */
export function whtSettingsToLinePercent(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const percent = n <= 1 ? n * 100 : n;
  return Math.round(percent * 10000) / 10000;
}

export function lineWithholdingAmount(params: {
  lineAfterDiscount: number;
  withholdingTaxRate?: number | string | null;
  withholdingTaxAmount?: number | string | null;
  /** Typed قيمة الخصم. A rate still drives the amount until the user edits it. */
  withholdingAmountManual?: boolean | null;
}) {
  const explicit = Number(params.withholdingTaxAmount);
  const rate = Number(params.withholdingTaxRate ?? 0);
  const base = Number(params.lineAfterDiscount) || 0;
  const fromRate = Number.isFinite(rate) && rate > 0 ? (base * rate) / 100 : 0;
  if (params.withholdingAmountManual && Number.isFinite(explicit) && explicit > 0) return explicit;
  if (fromRate > 0) return fromRate;
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return 0;
}
