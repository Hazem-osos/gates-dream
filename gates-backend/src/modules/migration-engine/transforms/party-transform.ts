import { legacyTrim } from './legacy-values';
import type { LegacyCustomerRow, LegacySupplierRow } from '../services/legacy-party-data.service';

function sanitizeEmail(raw: string): string | null {
  const e = raw.trim();
  if (!e) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

function mapHow(customerCase: string): 'local' | 'export' | 'exempt' | undefined {
  const c = customerCase.trim().toUpperCase();
  if (c === 'L') return 'local';
  if (c === 'E') return 'export';
  if (c === 'X') return 'exempt';
  return undefined;
}

export function transformCustomerRow(
  row: LegacyCustomerRow,
  companyId: string,
  mainAccountId: string,
  customerCategoryId?: string | null
) {
  return {
    companyId,
    code: row.customerCode,
    serial: row.customerCode,
    arabicName: row.arabicName,
    englishName: row.englishName || null,
    customerType: row.customerType?.toLowerCase().includes('ind') ? 'individual' : 'company',
    how: mapHow(row.customerCase),
    phone1: row.phone1 || null,
    phone2: row.phone2 || null,
    mobile: row.mobile || null,
    fax: row.fax || null,
    email: sanitizeEmail(row.email),
    website: row.site || null,
    country: row.city ? null : null,
    city: row.city || null,
    street: row.street || row.address || null,
    mainAccountId,
    accountId: mainAccountId,
    currencyCode: legacyTrim(row.currencyCode) || null,
    taxAuthority: row.tradeNum || null,
    taxData: Boolean(row.tradeNum),
    customerCategoryId: customerCategoryId ?? null,
    isActive: true,
    balance: 0,
  };
}

export function transformSupplierRow(
  row: LegacySupplierRow,
  companyId: string,
  mainAccountId: string,
  supplierCategoryId?: string | null
) {
  return {
    companyId,
    code: row.supplierCode,
    serial: row.supplierCode,
    arabicName: row.arabicName,
    englishName: row.englishName || null,
    supplierType: 'company',
    how: 'local' as const,
    phone1: row.phone1 || null,
    phone2: row.phone2 || null,
    mobile: row.mobile || null,
    fax: row.fax || null,
    email: sanitizeEmail(row.email),
    website: row.site || null,
    street: row.street || row.address || null,
    mainAccountId,
    accountId: mainAccountId,
    currencyCode: legacyTrim(row.currencyCode) || null,
    supplierCategoryId: supplierCategoryId ?? null,
    isActive: true,
    balance: 0,
  };
}
