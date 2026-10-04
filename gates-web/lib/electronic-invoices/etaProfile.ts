export type EtaReceiverType = 'B' | 'P' | 'F';
export type EtaItemCodeType = 'EGS' | 'GS1';

export type EtaCustomerProfile = {
  receiverType?: EtaReceiverType;
  taxId?: string;
  name?: string;
  taxOffice?: string;
  country?: string;
  governate?: string;
  regionCity?: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  address?: string;
};

export type EtaItemProfile = {
  itemType?: EtaItemCodeType;
  itemCode?: string;
  unitType?: string;
  description?: string;
  taxType?: string;
  taxSubType?: string;
  taxRate?: string;
  withholdingSubType?: string;
};

export type EtaIssuerProfile = {
  taxId?: string;
  name?: string;
  activityCode?: string;
  country?: string;
  governate?: string;
  regionCity?: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  additionalInformation?: string;
  branchID?: string;
  withholdingSubType?: string;
};

/** أكواد الوحدات المعتمدة في الفاتورة الإلكترونية (ETA). */
export const ETA_UNIT_CODES: { code: string; label: string }[] = [
  { code: 'EA', label: 'EA — قطعة / عدد' },
  { code: 'JOB', label: 'JOB — خدمة' },
  { code: 'C62', label: 'C62 — وحدة' },
  { code: 'H87', label: 'H87 — قطعة' },
  { code: 'XPP', label: 'XPP — قطعة' },
  { code: 'SET', label: 'SET — طقم' },
  { code: 'PR', label: 'PR — زوج' },
  { code: 'DZN', label: 'DZN — دستة' },
  { code: 'BX', label: 'BX — صندوق' },
  { code: 'CT', label: 'CT — كرتونة' },
  { code: 'PK', label: 'PK — باكت' },
  { code: 'BG', label: 'BG — كيس' },
  { code: 'ROL', label: 'ROL — رول' },
  { code: 'KGM', label: 'KGM — كيلوجرام' },
  { code: 'GRM', label: 'GRM — جرام' },
  { code: 'TNE', label: 'TNE — طن' },
  { code: 'LTR', label: 'LTR — لتر' },
  { code: 'MLT', label: 'MLT — ملليلتر' },
  { code: 'MTR', label: 'MTR — متر' },
  { code: 'CMT', label: 'CMT — سنتيمتر' },
  { code: 'MMT', label: 'MMT — مليمتر' },
  { code: 'MTK', label: 'MTK — متر مربع' },
  { code: 'MTQ', label: 'MTQ — متر مكعب' },
  { code: 'HUR', label: 'HUR — ساعة' },
  { code: 'DAY', label: 'DAY — يوم' },
  { code: 'WEE', label: 'WEE — أسبوع' },
  { code: 'MON', label: 'MON — شهر' },
  { code: 'ANN', label: 'ANN — سنة' },
  { code: 'KWH', label: 'KWH — كيلووات ساعة' },
  { code: 'MIN', label: 'MIN — دقيقة' },
];

export const ETA_WITHHOLDING_SUBTYPES = [
  { code: 'W001', label: 'W001 — توريدات / مشتريات' },
  { code: 'W002', label: 'W002 — خدمات' },
  { code: 'W003', label: 'W003 — مقاولات' },
  { code: 'W004', label: 'W004 — توريدات أخرى' },
  { code: 'W005', label: 'W005 — خدمات مهنية' },
  { code: 'W006', label: 'W006 — إيجارات' },
  { code: 'W007', label: 'W007 — عمولات' },
  { code: 'W008', label: 'W008 — توزيعات أرباح' },
  { code: 'W009', label: 'W009 — أتاوات' },
  { code: 'W010', label: 'W010 — أخرى' },
] as const;

export const EMPTY_CUSTOMER_ETA: EtaCustomerProfile = {
  receiverType: 'B',
  taxId: '',
  name: '',
  taxOffice: '',
  country: 'EG',
  governate: '',
  regionCity: '',
  street: '',
  buildingNumber: '',
  postalCode: '',
  address: '',
};

export const ETA_COUNTRIES: { code: string; name: string }[] = [
  { code: 'EG', name: 'مصر' },
  { code: 'SA', name: 'السعودية' },
  { code: 'AE', name: 'الإمارات' },
  { code: 'KW', name: 'الكويت' },
  { code: 'QA', name: 'قطر' },
  { code: 'BH', name: 'البحرين' },
  { code: 'OM', name: 'عُمان' },
  { code: 'JO', name: 'الأردن' },
  { code: 'LB', name: 'لبنان' },
  { code: 'SY', name: 'سوريا' },
  { code: 'IQ', name: 'العراق' },
  { code: 'YE', name: 'اليمن' },
  { code: 'PS', name: 'فلسطين' },
  { code: 'LY', name: 'ليبيا' },
  { code: 'TN', name: 'تونس' },
  { code: 'DZ', name: 'الجزائر' },
  { code: 'MA', name: 'المغرب' },
  { code: 'SD', name: 'السودان' },
  { code: 'MR', name: 'موريتانيا' },
  { code: 'SO', name: 'الصومال' },
  { code: 'DJ', name: 'جيبوتي' },
  { code: 'KM', name: 'جزر القمر' },
  { code: 'US', name: 'الولايات المتحدة' },
  { code: 'GB', name: 'المملكة المتحدة' },
  { code: 'DE', name: 'ألمانيا' },
  { code: 'FR', name: 'فرنسا' },
  { code: 'IT', name: 'إيطاليا' },
  { code: 'ES', name: 'إسبانيا' },
  { code: 'TR', name: 'تركيا' },
  { code: 'CN', name: 'الصين' },
  { code: 'JP', name: 'اليابان' },
  { code: 'IN', name: 'الهند' },
  { code: 'RU', name: 'روسيا' },
  { code: 'CA', name: 'كندا' },
  { code: 'AU', name: 'أستراليا' },
  { code: 'CH', name: 'سويسرا' },
  { code: 'NL', name: 'هولندا' },
  { code: 'GR', name: 'اليونان' },
  { code: 'CY', name: 'قبرص' },
];

export function etaCountryName(code: string | undefined): string {
  const value = (code || '').trim();
  if (!value) return '';
  return ETA_COUNTRIES.find((row) => row.code === value)?.name || value;
}

export function composeEtaAddressParts(parts: {
  buildingNumber?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  governorate?: string | null;
  country?: string | null;
  postalCode?: string | null;
}): string {
  const country = etaCountryName(parts.country || undefined);
  return [
    parts.buildingNumber,
    parts.street,
    parts.district,
    parts.city,
    parts.governorate,
    country,
    parts.postalCode,
  ]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join('، ');
}

export function composeCustomerEtaAddress(form: EtaCustomerProfile): string {
  return composeEtaAddressParts({
    buildingNumber: form.buildingNumber,
    street: form.street,
    city: form.regionCity,
    governorate: form.governate,
    country: form.country,
    postalCode: form.postalCode,
  });
}

export const EMPTY_ITEM_ETA: EtaItemProfile = {
  itemType: 'EGS',
  itemCode: '',
  unitType: 'EA',
  description: '',
  taxType: 'T1',
  taxSubType: 'V009',
  taxRate: '14',
  withholdingSubType: 'W001',
};

export const EMPTY_ISSUER_ETA: EtaIssuerProfile = {
  taxId: '',
  name: '',
  activityCode: '',
  country: 'EG',
  governate: '',
  regionCity: '',
  street: '',
  buildingNumber: '',
  postalCode: '',
  additionalInformation: '',
  branchID: '0',
  withholdingSubType: 'W001',
};

export function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry != null) out[key] = String(entry);
  }
  return out;
}
