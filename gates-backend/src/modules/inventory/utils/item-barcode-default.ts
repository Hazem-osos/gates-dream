/** When barcode is omitted, use the item serial (legacy ERP behavior). */
export function resolveItemBarcode(
  barcode: string | null | undefined,
  serial: string | null | undefined
): string | null {
  const trimmedBarcode = barcode?.trim();
  if (trimmedBarcode) return trimmedBarcode;
  const trimmedSerial = serial?.trim();
  return trimmedSerial || null;
}
