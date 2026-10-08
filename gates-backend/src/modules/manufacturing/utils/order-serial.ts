export function stripManufacturingOrderSourceSuffix(sourceNumber: string): string {
  const raw = sourceNumber.trim();
  if (!raw) return '';
  return raw.replace(/-(OH|FG|UNI)$/i, '');
}

export function formatManufacturingOrderSerial(sourceNumber: string, padding = 10): string {
  const base = stripManufacturingOrderSourceSuffix(sourceNumber);
  const digits = base.replace(/\D/g, '');
  if (!digits) return base;
  return digits.padStart(padding, '0');
}
