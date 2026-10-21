import type { SubcontractorContact, SubcontractorDetailsBag } from './types';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseVendorDetails(value: unknown): SubcontractorDetailsBag {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { contacts: [] };
  }
  const raw = value as Record<string, unknown>;
  return {
    taxOffice: text(raw.taxOffice),
    taxFileNumber: text(raw.taxFileNumber),
    fax: text(raw.fax),
    dealNature: text(raw.dealNature),
    paymentMethod: text(raw.paymentMethod),
    bankName: text(raw.bankName),
    iban: text(raw.iban),
    accountNumber: text(raw.accountNumber),
    notes: text(raw.notes),
    contacts: Array.isArray(raw.contacts)
      ? raw.contacts.flatMap((row): SubcontractorContact[] => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
          const item = row as Record<string, unknown>;
          const nameAr = text(item.nameAr);
          if (!nameAr) return [];
          return [
            {
              nameAr,
              nameEn: text(item.nameEn),
              job: text(item.job),
              mobile: text(item.mobile),
              email: text(item.email),
              nationalId: text(item.nationalId),
              suspended: item.suspended === true,
            },
          ];
        })
      : [],
  };
}

export const SUBCONTRACTOR_STATUS_AR: Record<string, string> = {
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  BLACKLISTED: 'محظور',
};
