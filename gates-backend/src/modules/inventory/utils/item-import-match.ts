export type ExistingItemKeys = {
  id: string;
  arabicName: string;
  englishName?: string | null;
  barcode?: string | null;
  serial?: string | null;
};

export type ItemImportMatchKind =
  | 'barcode'
  | 'serial'
  | 'name'
  | 'sheet-barcode'
  | 'sheet-serial'
  | 'sheet-name';

export type ItemImportMatch = { kind: ItemImportMatchKind; itemId?: string };

export function normalizeItemImportName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()
    .toLowerCase();
}

export function normalizeItemImportCode(value: string): string {
  return value.trim().toLowerCase();
}

export function itemImportNameKey(value: string | null | undefined): string {
  return value ? normalizeItemImportName(value) : '';
}

export function itemImportCodeKey(value: string | null | undefined): string {
  return value ? normalizeItemImportCode(value) : '';
}

export function matchImportedItem(
  row: { arabicName: string; barcode?: string | null; serial?: string | null },
  existingByBarcode: Map<string, string>,
  existingBySerial: Map<string, string>,
  existingByName: Map<string, string>,
  seen: { barcodes: Set<string>; serials: Set<string>; names: Set<string> }
): ItemImportMatch | null {
  const barcode = itemImportCodeKey(row.barcode);
  const serial = itemImportCodeKey(row.serial);
  const name = itemImportNameKey(row.arabicName);

  if (barcode && existingByBarcode.has(barcode)) {
    return { kind: 'barcode', itemId: existingByBarcode.get(barcode) };
  }
  if (serial && existingBySerial.has(serial)) {
    return { kind: 'serial', itemId: existingBySerial.get(serial) };
  }
  if (barcode && existingBySerial.has(barcode)) {
    return { kind: 'serial', itemId: existingBySerial.get(barcode) };
  }
  if (serial && existingByBarcode.has(serial)) {
    return { kind: 'barcode', itemId: existingByBarcode.get(serial) };
  }
  if (name && existingByName.has(name)) {
    return { kind: 'name', itemId: existingByName.get(name) };
  }

  if (barcode && seen.barcodes.has(barcode)) return { kind: 'sheet-barcode' };
  if (serial && seen.serials.has(serial)) return { kind: 'sheet-serial' };
  if (name && seen.names.has(name)) return { kind: 'sheet-name' };

  return null;
}

export function rememberImportedItemKeys(
  row: { arabicName: string; barcode?: string | null; serial?: string | null },
  seen: { barcodes: Set<string>; serials: Set<string>; names: Set<string> }
) {
  const barcode = itemImportCodeKey(row.barcode);
  const serial = itemImportCodeKey(row.serial);
  const name = itemImportNameKey(row.arabicName);
  if (barcode) seen.barcodes.add(barcode);
  if (serial) seen.serials.add(serial);
  if (name) seen.names.add(name);
}

export function indexExistingItems(items: ExistingItemKeys[]) {
  const existingByBarcode = new Map<string, string>();
  const existingBySerial = new Map<string, string>();
  const existingByName = new Map<string, string>();
  for (const item of items) {
    const barcode = itemImportCodeKey(item.barcode);
    const serial = itemImportCodeKey(item.serial);
    const arabic = itemImportNameKey(item.arabicName);
    const english = itemImportNameKey(item.englishName);
    if (barcode) existingByBarcode.set(barcode, item.id);
    if (serial) existingBySerial.set(serial, item.id);
    if (arabic) existingByName.set(arabic, item.id);
    if (english) existingByName.set(english, item.id);
  }
  return { existingByBarcode, existingBySerial, existingByName };
}
