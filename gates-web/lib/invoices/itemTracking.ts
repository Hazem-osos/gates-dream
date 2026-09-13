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

export function lineWithholdingAmount(params: {
  lineAfterDiscount: number;
  withholdingTaxRate?: number | string | null;
  withholdingTaxAmount?: number | string | null;
}) {
  const explicit = Number(params.withholdingTaxAmount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const rate = Number(params.withholdingTaxRate ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return (Number(params.lineAfterDiscount) || 0) * (rate / 100);
}
