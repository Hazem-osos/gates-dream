/** Strip journal suffixes (-OH, -FG, -UNI) from movement source numbers. */
export function stripManufacturingOrderSourceSuffix(sourceNumber: string): string {
  const raw = sourceNumber.trim();
  if (!raw) return '';
  return raw.replace(/-(OH|FG|UNI)$/i, '');
}

/** Display manufacturing order serial as zero-padded digits (legacy: 10 digits). */
export function formatManufacturingOrderSerial(sourceNumber: string, padding = 10): string {
  const base = stripManufacturingOrderSourceSuffix(sourceNumber);
  const digits = base.replace(/\D/g, '');
  if (!digits) return base;
  return digits.padStart(padding, '0');
}

export function manufacturingOrderHref(orderId: string | null | undefined): string | null {
  const id = orderId?.trim();
  if (!id) return null;
  return `/manufacturing/operations/operation?orderId=${encodeURIComponent(id)}`;
}
