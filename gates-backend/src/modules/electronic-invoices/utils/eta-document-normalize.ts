import { AppError } from '../../../shared/middleware/error-handler';
import {
  canonicalGovernorate,
  formatEgsItemCode,
  resolveItemCodification,
  validateEgsItemCode,
  validateGs1ItemCode,
} from './eta-egypt-validation';

/**
 * Unit and country catalogs already used by the e-invoice screens.
 * Matching is exact after trim/case; there is no extra alias table.
 */
export const ETA_UNIT_CODES = [
  'EA',
  'JOB',
  'C62',
  'H87',
  'XPP',
  'SET',
  'PR',
  'DZN',
  'BX',
  'CT',
  'PK',
  'BG',
  'ROL',
  'KGM',
  'GRM',
  'TNE',
  'LTR',
  'MLT',
  'MTR',
  'CMT',
  'MMT',
  'MTK',
  'MTQ',
  'HUR',
  'DAY',
  'WEE',
  'MON',
  'ANN',
  'KWH',
  'MIN',
] as const;

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

const UNIT_SET = new Set<string>(ETA_UNIT_CODES);
const COUNTRY_CODES = new Set(ETA_COUNTRIES.map((row) => row.code));

export type EtaCodeIssue = {
  code: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

type EtaAddressLike = {
  country?: string;
  governate?: string;
  regionCity?: string;
  street?: string;
  buildingNumber?: string;
  branchID?: string;
  postalCode?: string;
  additionalInformation?: string;
};

type EtaUnitValueLike = {
  currencySold?: string;
  amountEGP?: number;
  amountSold?: number;
  currencyExchangeRate?: number;
};

type EtaLineLike = {
  itemType?: string;
  itemCode?: string;
  unitType?: string;
  description?: string;
  unitValue?: EtaUnitValueLike;
};

export type EtaNormalizableInvoice = {
  taxpayerActivityCode?: string;
  issuer?: { id?: string; address?: EtaAddressLike };
  receiver?: { address?: EtaAddressLike };
  invoiceLines?: EtaLineLike[];
};

export type EtaNormalizableReceipt = {
  seller?: { rin?: string };
  itemData?: EtaLineLike[];
};

function trimText(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

/** ETA rejects amountSold and currencyExchangeRate when the sold currency is EGP. */
function unitValueForEta(unitValue: EtaUnitValueLike | undefined): EtaUnitValueLike | undefined {
  if (!unitValue) return undefined;
  if (trimText(unitValue.currencySold).toUpperCase() !== 'EGP') return unitValue;
  const next = { ...unitValue };
  delete next.amountSold;
  delete next.currencyExchangeRate;
  return next;
}

export function canonicalActivityCode(value: string | null | undefined): string {
  return trimText(value);
}

/** First non-empty activity code, skipping the fake 0000 placeholder. */
export function firstActivityCode(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const code = canonicalActivityCode(value);
    if (code && code !== '0000') return code;
  }
  return '';
}

export function canonicalCountryCode(value: string | null | undefined): string {
  const text = trimText(value);
  if (!text) return '';
  const byCode = ETA_COUNTRIES.find((row) => row.code.toLowerCase() === text.toLowerCase());
  if (byCode) return byCode.code;
  const byName = ETA_COUNTRIES.find((row) => row.name === text);
  return byName?.code ?? text;
}

export function canonicalUnitType(value: string | null | undefined): string {
  const text = trimText(value);
  if (!text) return '';
  const match = ETA_UNIT_CODES.find((code) => code.toLowerCase() === text.toLowerCase());
  return match ?? text;
}

export function normalizeEtaItemCode(input: {
  itemType?: string | null;
  itemCode: string;
  issuerTaxId: string;
}): { itemType: 'EGS' | 'GS1'; itemCode: string } {
  const raw = trimText(input.itemCode);
  if (input.itemType === 'GS1') {
    return { itemType: 'GS1', itemCode: raw };
  }
  if (input.itemType === 'EGS') {
    return { itemType: 'EGS', itemCode: formatEgsItemCode(input.issuerTaxId, raw) };
  }
  return resolveItemCodification(raw, input.issuerTaxId);
}

function normalizeAddress<T extends EtaAddressLike>(address: T): T {
  const next = { ...address };
  if (typeof next.country === 'string') next.country = canonicalCountryCode(next.country);
  if (typeof next.governate === 'string') next.governate = canonicalGovernorate(next.governate);
  if (typeof next.regionCity === 'string') next.regionCity = next.regionCity.trim();
  if (typeof next.street === 'string') next.street = next.street.trim();
  if (typeof next.buildingNumber === 'string') next.buildingNumber = next.buildingNumber.trim();
  if (typeof next.branchID === 'string') next.branchID = next.branchID.trim();
  if (typeof next.postalCode === 'string') next.postalCode = next.postalCode.trim();
  if (typeof next.additionalInformation === 'string') {
    next.additionalInformation = next.additionalInformation.trim();
  }
  return next;
}

function itemCodeIssue(
  identity: { itemType: 'EGS' | 'GS1'; itemCode: string },
  issuerTaxId: string,
  field: string,
  itemName: string
): EtaCodeIssue | null {
  const code = identity.itemCode;
  if (identity.itemType === 'EGS' && (code !== code.trim() || !validateEgsItemCode(code, issuerTaxId))) {
    return {
      code: 'INVALID_EGS_CODE',
      field,
      message: `كود EGS غير صالح للصنف ${itemName} (المطلوب EG-رقمضريبي-كود)`,
      severity: 'error',
    };
  }
  if (identity.itemType === 'GS1' && (code !== code.trim() || !validateGs1ItemCode(code))) {
    return {
      code: 'INVALID_GS1',
      field,
      message: `باركود GS1 غير صالح للصنف ${itemName}`,
      severity: 'error',
    };
  }
  return null;
}

function unitIssue(unitType: string, field: string, itemName: string): EtaCodeIssue | null {
  if (UNIT_SET.has(unitType)) return null;
  return {
    code: 'INVALID_UNIT_TYPE',
    field,
    message: `كود الوحدة غير موجود في قائمة مصلحة الضرائب للصنف ${itemName}: ${unitType || 'فارغ'}`,
    severity: 'error',
  };
}

function addressIssues(address: EtaAddressLike | undefined, prefix: string, label: string): EtaCodeIssue[] {
  if (!address) return [];
  const issues: EtaCodeIssue[] = [];
  const country = address.country ?? '';
  if (!COUNTRY_CODES.has(country)) {
    issues.push({
      code: 'INVALID_COUNTRY',
      field: `${prefix}.country`,
      message: `كود دولة ${label} غير موجود في قائمة مصلحة الضرائب: ${country || 'فارغ'}`,
      severity: 'error',
    });
  }
  return issues;
}

/** Read-only checks against the document that will be signed. Does not rewrite it. */
export function collectEtaDocumentIssues(
  document: EtaNormalizableInvoice,
  issuerTaxId: string
): EtaCodeIssue[] {
  const issues: EtaCodeIssue[] = [];
  const activity = document.taxpayerActivityCode ?? '';
  if (!activity || activity !== activity.trim() || activity === '0000') {
    issues.push({
      code: 'INVALID_ACTIVITY_CODE',
      field: 'taxpayerActivityCode',
      message: 'كود النشاط taxpayerActivityCode مطلوب قبل الإرسال لمصلحة الضرائب',
      severity: 'error',
    });
  }
  issues.push(...addressIssues(document.issuer?.address, 'issuer.address', 'الشركة'));
  if (document.receiver?.address) {
    issues.push(...addressIssues(document.receiver.address, 'receiver.address', 'العميل'));
  }
  (document.invoiceLines ?? []).forEach((line, index) => {
    const itemName = trimText(line.description) || `بند ${index + 1}`;
    const identity = {
      itemType: line.itemType === 'GS1' ? ('GS1' as const) : ('EGS' as const),
      itemCode: line.itemCode ?? '',
    };
    const codeIssue = itemCodeIssue(identity, issuerTaxId, `invoiceLines.${index}.itemCode`, itemName);
    if (codeIssue) issues.push(codeIssue);
    const unit = unitIssue(line.unitType ?? '', `invoiceLines.${index}.unitType`, itemName);
    if (unit) issues.push(unit);
  });
  return issues;
}

export function collectRawItemCodeIssue(input: {
  itemType?: string | null;
  itemCode: string;
  issuerTaxId: string;
  field: string;
  itemName: string;
}): EtaCodeIssue | null {
  const inferred = resolveItemCodification(input.itemCode, input.issuerTaxId);
  const identity = normalizeEtaItemCode({
    itemType: input.itemType || inferred.itemType,
    itemCode: input.itemCode,
    issuerTaxId: input.issuerTaxId,
  });
  return itemCodeIssue(identity, input.issuerTaxId, input.field, input.itemName);
}

/**
 * Build output → one normalized document.
 * Callers validate, sign, and submit this object. A second call does not change it.
 */
export function normalizeEtaInvoiceDocument<T extends EtaNormalizableInvoice>(
  document: T,
  issuerTaxId: string
): T {
  const next = structuredClone(document);
  next.taxpayerActivityCode = canonicalActivityCode(next.taxpayerActivityCode);
  if (next.issuer?.address) next.issuer.address = normalizeAddress(next.issuer.address);
  if (next.receiver?.address) next.receiver.address = normalizeAddress(next.receiver.address);
  if (next.invoiceLines) {
    next.invoiceLines = next.invoiceLines.map((line) => {
      const inferred = resolveItemCodification(line.itemCode ?? '', issuerTaxId);
      const identity = normalizeEtaItemCode({
        itemType: line.itemType || inferred.itemType,
        itemCode: line.itemCode ?? '',
        issuerTaxId,
      });
      const unitValue = unitValueForEta(line.unitValue);
      return {
        ...line,
        itemType: identity.itemType,
        itemCode: identity.itemCode,
        unitType: canonicalUnitType(line.unitType),
        ...(unitValue ? { unitValue } : {}),
      };
    });
  }
  return next;
}

export function authoritativeEtaInvoiceDocument<T extends EtaNormalizableInvoice>(
  built: T,
  issuerTaxId: string
): { document: T; issues: EtaCodeIssue[] } {
  const document = normalizeEtaInvoiceDocument(built, issuerTaxId);
  return { document, issues: collectEtaDocumentIssues(document, issuerTaxId) };
}

/** Throws without changing the document. Signing must use the same object that passed. */
export function assertEtaInvoiceDocument(document: EtaNormalizableInvoice): void {
  const issuerTaxId = trimText(document.issuer?.id);
  const errors = collectEtaDocumentIssues(document, issuerTaxId).filter((issue) => issue.severity === 'error');
  if (errors.length === 0) return;
  throw new AppError(422, errors.map((issue) => issue.message).join(' — '));
}

export function normalizeEtaReceiptDocument<T extends EtaNormalizableReceipt>(document: T): T {
  const next = structuredClone(document);
  const issuerTaxId = trimText(next.seller?.rin);
  if (next.itemData) {
    next.itemData = next.itemData.map((line) => {
      const identity = normalizeEtaItemCode({
        itemType: line.itemType || 'EGS',
        itemCode: line.itemCode ?? '',
        issuerTaxId,
      });
      return {
        ...line,
        itemType: identity.itemType,
        itemCode: identity.itemCode,
        unitType: canonicalUnitType(line.unitType || 'EA') || 'EA',
      };
    });
  }
  return next;
}

export function assertEtaReceiptDocument(document: EtaNormalizableReceipt): void {
  const issuerTaxId = trimText(document.seller?.rin);
  const errors: EtaCodeIssue[] = [];
  (document.itemData ?? []).forEach((line, index) => {
    const itemName = trimText(line.description) || `بند ${index + 1}`;
    const identity = {
      itemType: line.itemType === 'GS1' ? ('GS1' as const) : ('EGS' as const),
      itemCode: line.itemCode ?? '',
    };
    const codeIssue = itemCodeIssue(identity, issuerTaxId, `itemData.${index}.itemCode`, itemName);
    if (codeIssue) errors.push(codeIssue);
    const unit = unitIssue(line.unitType ?? '', `itemData.${index}.unitType`, itemName);
    if (unit) errors.push(unit);
  });
  if (errors.length === 0) return;
  throw new AppError(422, errors.map((issue) => issue.message).join(' — '));
}
