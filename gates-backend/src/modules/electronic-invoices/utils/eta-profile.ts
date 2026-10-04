export type EtaReceiverType = 'B' | 'P' | 'F';
export type EtaItemCodeType = 'EGS' | 'GS1';

export type EtaAddressProfile = {
  country?: string;
  governate?: string;
  regionCity?: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  floor?: string;
  room?: string;
  landmark?: string;
  additionalInformation?: string;
  branchID?: string;
};

export type EtaCustomerProfile = EtaAddressProfile & {
  receiverType?: EtaReceiverType;
  taxId?: string;
  name?: string;
};

export type EtaItemProfile = {
  itemType?: EtaItemCodeType;
  itemCode?: string;
  unitType?: string;
  description?: string;
  taxType?: string;
  taxSubType?: string;
  taxRate?: number | string;
  withholdingSubType?: string;
};

export type EtaIssuerProfile = EtaAddressProfile & {
  taxId?: string;
  name?: string;
  activityCode?: string;
  withholdingSubType?: string;
};

export function composeEtaAddress(parts: {
  buildingNumber?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  governorate?: string | null;
  country?: string | null;
  postalCode?: string | null;
}): string {
  return [
    parts.buildingNumber,
    parts.street,
    parts.district,
    parts.city,
    parts.governorate,
    parts.country && parts.country !== 'EG' ? parts.country : parts.country === 'EG' ? 'مصر' : parts.country,
    parts.postalCode,
  ]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join('، ');
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function asEtaCustomerProfile(value: unknown): EtaCustomerProfile {
  if (!value || typeof value !== 'object') return {};
  return value as EtaCustomerProfile;
}

export function asEtaItemProfile(value: unknown): EtaItemProfile {
  if (!value || typeof value !== 'object') return {};
  return value as EtaItemProfile;
}

export function asEtaIssuerProfile(value: unknown): EtaIssuerProfile {
  if (!value || typeof value !== 'object') return {};
  return value as EtaIssuerProfile;
}

export function missingCustomerEtaFields(profile: EtaCustomerProfile, fallbackName = ''): string[] {
  const missing: string[] = [];
  if (!profile.receiverType) missing.push('نوع العميل (B/P/F)');
  if (!text(profile.taxId)) missing.push('الرقم الضريبي أو الرقم القومي');
  if (!text(profile.name) && !text(fallbackName)) missing.push('اسم العميل في الفاتورة الإلكترونية');
  if (!text(profile.governate)) missing.push('محافظة العميل');
  if (!text(profile.regionCity)) missing.push('مدينة/حي العميل');
  if (!text(profile.street)) missing.push('شارع العميل');
  if (!text(profile.buildingNumber)) missing.push('رقم المبنى للعميل');
  return missing;
}

export function missingItemEtaFields(profile: EtaItemProfile, fallbackName = ''): string[] {
  const missing: string[] = [];
  if (!profile.itemType) missing.push(`نوع كود الصنف ${fallbackName}`.trim());
  if (!text(profile.itemCode)) missing.push(`كود ETA للصنف ${fallbackName}`.trim());
  if (!text(profile.unitType)) missing.push(`وحدة ETA للصنف ${fallbackName}`.trim());
  return missing;
}

export function missingIssuerEtaFields(profile: EtaIssuerProfile): string[] {
  const missing: string[] = [];
  if (!text(profile.taxId)) missing.push('الرقم الضريبي للشركة');
  if (!text(profile.name)) missing.push('اسم الشركة في الفاتورة الإلكترونية');
  if (!text(profile.activityCode)) missing.push('كود النشاط taxpayerActivityCode');
  if (!text(profile.governate)) missing.push('محافظة الشركة');
  if (!text(profile.regionCity)) missing.push('مدينة/حي الشركة');
  if (!text(profile.street)) missing.push('شارع الشركة');
  if (!text(profile.buildingNumber)) missing.push('رقم مبنى الشركة');
  return missing;
}
