export const ARCHIVE_ENTITY_TYPES = [
  'INVOICE',
  'JOURNAL_ENTRY',
  'TREASURY_VOUCHER',
  'EMPLOYEE',
  'REAL_ESTATE_CONTRACT',
  'PROJECT',
  'CHEQUE',
  'SUBCONTRACT',
  'SUBCONTRACT_INVOICE',
  'SITE_PENALTY',
  'MATERIAL_RECONCILIATION',
  'EXECUTIVE_MEASUREMENT_SHEET',
  'CLIENT_CONTRACT',
  'CLIENT_INVOICE',
  'LETTER_OF_GUARANTEE',
  'PROPERTY_UNIT',
  'UNIT_CONTRACT',
] as const;

export type ArchiveEntityType = (typeof ARCHIVE_ENTITY_TYPES)[number];

export function isArchiveEntityType(value: string): value is ArchiveEntityType {
  return (ARCHIVE_ENTITY_TYPES as readonly string[]).includes(value);
}
