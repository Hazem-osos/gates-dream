/** When barcode is omitted, use the item serial (matches backend). */
export function resolveItemBarcode(barcode: string, serial: string): string {
  const b = barcode.trim();
  if (b) return b;
  return serial.trim();
}
