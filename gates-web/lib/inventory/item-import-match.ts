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

export function itemImportNameKey(value: string | null | undefined): string {
  return value ? normalizeItemImportName(value) : '';
}

export function itemImportCodeKey(value: string | null | undefined): string {
  return value ? value.trim().toLowerCase() : '';
}

export function matchStatusLabel(kind: ItemImportMatchKind | null): string {
  if (!kind) return 'جديد';
  if (kind === 'barcode') return 'موجود — باركود';
  if (kind === 'serial') return 'موجود — رقم الصنف';
  if (kind === 'name') return 'موجود — نفس الاسم';
  if (kind === 'sheet-barcode') return 'مكرر في الشيت — باركود';
  if (kind === 'sheet-serial') return 'مكرر في الشيت — رقم';
  return 'مكرر في الشيت — اسم';
}

export function tagItemImportRows<T extends { arabicName: string; barcode?: string | null; serial?: string | null }>(
  rows: T[],
  existing: ExistingItemKeys[]
): Array<T & { matchKind: ItemImportMatchKind | null }> {
  const existingByBarcode = new Map<string, string>();
  const existingBySerial = new Map<string, string>();
  const existingByName = new Map<string, string>();
  for (const item of existing) {
    const barcode = itemImportCodeKey(item.barcode);
    const serial = itemImportCodeKey(item.serial);
    const arabic = itemImportNameKey(item.arabicName);
    const english = itemImportNameKey(item.englishName);
    if (barcode) existingByBarcode.set(barcode, item.id);
    if (serial) existingBySerial.set(serial, item.id);
    if (arabic) existingByName.set(arabic, item.id);
    if (english) existingByName.set(english, item.id);
  }

  const seen = { barcodes: new Set<string>(), serials: new Set<string>(), names: new Set<string>() };
  return rows.map((row) => {
    const barcode = itemImportCodeKey(row.barcode);
    const serial = itemImportCodeKey(row.serial);
    const name = itemImportNameKey(row.arabicName);
    let matchKind: ItemImportMatchKind | null = null;
    if (barcode && existingByBarcode.has(barcode)) matchKind = 'barcode';
    else if (serial && existingBySerial.has(serial)) matchKind = 'serial';
    else if (barcode && existingBySerial.has(barcode)) matchKind = 'serial';
    else if (serial && existingByBarcode.has(serial)) matchKind = 'barcode';
    else if (name && existingByName.has(name)) matchKind = 'name';
    else if (barcode && seen.barcodes.has(barcode)) matchKind = 'sheet-barcode';
    else if (serial && seen.serials.has(serial)) matchKind = 'sheet-serial';
    else if (name && seen.names.has(name)) matchKind = 'sheet-name';
    if (barcode) seen.barcodes.add(barcode);
    if (serial) seen.serials.add(serial);
    if (name) seen.names.add(name);
    return { ...row, matchKind };
  });
}
