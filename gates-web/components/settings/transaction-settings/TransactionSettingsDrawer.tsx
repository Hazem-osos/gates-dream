'use client';

import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { TransactionSettingsForm } from '@/components/settings/transaction-settings/TransactionSettingsForm';
import {
  DOCUMENT_TYPE_TITLE,
  type TransactionDocumentType,
} from '@/lib/transaction-settings/types';

export function TransactionSettingsDrawer({
  open,
  onClose,
  documentType,
}: {
  open: boolean;
  onClose: () => void;
  documentType: TransactionDocumentType;
}) {
  return (
    <MasterEntitySideDrawer
      open={open}
      onClose={onClose}
      title={DOCUMENT_TYPE_TITLE[documentType]}
      subtitle="سياسات الترقيم والترحيل والتسعير والضرائب لهذا المستند"
    >
      <TransactionSettingsForm documentType={documentType} compact />
    </MasterEntitySideDrawer>
  );
}
