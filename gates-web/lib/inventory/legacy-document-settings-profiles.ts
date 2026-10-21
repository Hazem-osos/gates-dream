import type { StoreDocumentSerialKind } from '@/lib/inventory/use-store-document-serial';

export type LegacyDocumentProfileId =
  | 'transfer'
  | 'stocktaking'
  | 'adjustment'
  | 'other-adjustment'
  | 'assembly'
  | 'disassembly'
  | 'purchase-order'
  | 'price-quote';

export const LEGACY_DOCUMENT_PROFILE_TITLES: Record<LegacyDocumentProfileId, string> = {
  transfer: 'إعدادات النقل المخزني',
  stocktaking: 'إعدادات تسوية الجرد',
  adjustment: 'إعدادات التسوية المخزنية',
  'other-adjustment': 'إعدادات التسوية الأخرى',
  assembly: 'إعدادات التجميع',
  disassembly: 'إعدادات التفكيك',
  'purchase-order': 'إعدادات أمر الشراء',
  'price-quote': 'إعدادات عرض السعر',
};

export const PROFILE_TO_SERIAL_KIND: Partial<
  Record<LegacyDocumentProfileId, StoreDocumentSerialKind>
> = {
  transfer: 'transfer',
  stocktaking: 'stocktaking',
  adjustment: 'adjustment',
  'other-adjustment': 'other-adjustment',
  assembly: 'assembly',
  disassembly: 'disassembly',
};

export type LegacyDocumentSettings = {
  profile: LegacyDocumentProfileId;
  moduleCode: string;
  numberingMode: 'AUTOMATIC' | 'MANUAL';
  sequenceMode: 'CONTINUOUS' | 'ANNUAL_RESET';
  autoPostOnSave: boolean;
  autoPrintOnSave: boolean;
  generateEntryOnSave: boolean;
  defaultWarehouseId: string | null;
};
