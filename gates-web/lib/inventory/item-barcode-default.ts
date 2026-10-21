/** When barcode is omitted, use the item serial (matches backend). */
export function resolveItemBarcode(barcode: string, serial: string): string {
  const b = barcode.trim();
  if (b) return b;
  return serial.trim();
}

/** Form input: blank when barcode equals serial (implicit default from save). */
export function barcodeInputFromStored(
  barcode: string | null | undefined,
  serial: string | null | undefined
): string {
  const b = (barcode ?? '').trim();
  const s = (serial ?? '').trim();
  if (!b || (s && b === s)) return '';
  return b;
}

/** What the barcode field shows: typed barcode, otherwise the item serial. */
export function barcodeFieldDisplay(barcode: string, serial: string): string {
  return barcode.trim() || serial.trim();
}
