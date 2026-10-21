import { isTreasuryDocumentType, type TransactionDocumentType } from '@/lib/transaction-settings/types';
import {
  PROFILE_TO_SERIAL_KIND,
  type LegacyDocumentProfileId,
} from '@/lib/inventory/legacy-document-settings-profiles';
import {
  storeDocumentNextNumberQueryKey,
  type StoreDocumentSerialKind,
} from '@/lib/inventory/use-store-document-serial';
import { manufacturingOrderSerialQueryKey } from '@/lib/manufacturing/use-manufacturing-order-serial';
import { manufacturingWorkOrderSerialQueryKey } from '@/lib/manufacturing/use-manufacturing-work-order-serial';

const DOC_TO_SERIAL_KIND: Partial<Record<TransactionDocumentType, StoreDocumentSerialKind>> = {
  STOCK_ISSUE: 'issue',
  STOCK_RECEIPT: 'receipt',
  STOCK_TRANSFER: 'transfer',
  STOCK_STOCKTAKING: 'stocktaking',
  STOCK_OTHER_ADJUSTMENT: 'other-adjustment',
  STOCK_ASSEMBLY: 'assembly',
  STOCK_DISASSEMBLY: 'disassembly',
};

const DOC_TO_MFG_SERIAL_KEY: Partial<
  Record<TransactionDocumentType, readonly unknown[]>
> = {
  MANUFACTURING_ORDER: manufacturingOrderSerialQueryKey(),
  MANUFACTURING_WORK_ORDER: manufacturingWorkOrderSerialQueryKey(),
};

export function invalidateAfterTransactionSettingsSave(
  invalidateQuery: (key: unknown[]) => void,
  documentType: TransactionDocumentType
) {
  invalidateQuery(['transaction-settings', documentType]);
  const kind = DOC_TO_SERIAL_KIND[documentType];
  if (kind) {
    invalidateQuery([...storeDocumentNextNumberQueryKey(kind)]);
  }
  const mfgKey = DOC_TO_MFG_SERIAL_KEY[documentType];
  if (mfgKey) {
    invalidateQuery([...mfgKey]);
  }
  if (isTreasuryDocumentType(documentType)) {
    invalidateQuery(['treasury-cash-next-number']);
    invalidateQuery(['cash-posting-mode']);
  }
  if (documentType === 'TEMPORARY_RECEIPT') {
    invalidateQuery(['temp-receipt-next-number']);
  }
}

export function invalidateAfterLegacyDocumentSettingsSave(
  invalidateQuery: (key: unknown[]) => void,
  profile: LegacyDocumentProfileId
) {
  invalidateQuery(['legacy-document-settings', profile]);
  const kind = PROFILE_TO_SERIAL_KIND[profile];
  if (kind) {
    invalidateQuery([...storeDocumentNextNumberQueryKey(kind)]);
  }
}
