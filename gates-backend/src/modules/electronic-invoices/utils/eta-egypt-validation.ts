/** Egyptian Tax Registration Number (RIN) — 9 digits for business issuers/receivers. */
export const ETA_RIN_REGEX = /^\d{9}$/;

/** Egyptian National ID — 14 digits (B2C / person receiver). */
export const ETA_NATIONAL_ID_REGEX = /^\d{14}$/;

export const ETA_GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Qalyubia',
  'Port Said',
  'Suez',
  'Damietta',
  'Dakahlia',
  'Sharqia',
  'Kalyoubia',
  'Kafr El Sheikh',
  'Gharbia',
  'Monufia',
  'Beheira',
  'Ismailia',
  'Fayoum',
  'Beni Suef',
  'Minya',
  'Assiut',
  'Sohag',
  'Qena',
  'Luxor',
  'Aswan',
  'Red Sea',
  'New Valley',
  'Matrouh',
  'North Sinai',
  'South Sinai',
] as const;

const GOV_SET = new Set<string>(ETA_GOVERNORATES.map((g) => g.toLowerCase()));

export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function validateEgyptianRin(value: string): boolean {
  return ETA_RIN_REGEX.test(normalizeDigits(value));
}

export function validateEgyptianNationalId(value: string): boolean {
  return ETA_NATIONAL_ID_REGEX.test(normalizeDigits(value));
}

export function validateGovernorate(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return GOV_SET.has(value.trim().toLowerCase());
}

/** EGS item code: EG-{TaxID}-{ItemCode} */
export function formatEgsItemCode(issuerTaxId: string, itemCode: string): string {
  const rin = normalizeDigits(issuerTaxId).slice(0, 9);
  const code = itemCode.replace(/^EG-/i, '').replace(new RegExp(`^${rin}-`), '');
  return `EG-${rin}-${code}`;
}

export function validateEgsItemCode(code: string, issuerTaxId: string): boolean {
  const rin = normalizeDigits(issuerTaxId);
  if (!ETA_RIN_REGEX.test(rin)) return false;
  const pattern = new RegExp(`^EG-${rin}-[A-Za-z0-9._-]+$`, 'i');
  return pattern.test(code.trim());
}

export function validateGs1ItemCode(code: string): boolean {
  return /^\d{8,14}$/.test(code.trim());
}

export function resolveItemCodification(
  rawCode: string,
  issuerTaxId: string
): { itemType: 'EGS' | 'GS1'; itemCode: string } {
  const trimmed = rawCode.trim();
  if (trimmed.toUpperCase().startsWith('EG-') || trimmed.includes('-')) {
    return { itemType: 'EGS', itemCode: formatEgsItemCode(issuerTaxId, trimmed) };
  }
  if (validateGs1ItemCode(trimmed)) {
    return { itemType: 'GS1', itemCode: trimmed };
  }
  return { itemType: 'EGS', itemCode: formatEgsItemCode(issuerTaxId, trimmed) };
}
