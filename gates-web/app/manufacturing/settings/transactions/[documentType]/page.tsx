'use client';

import { notFound, useParams } from 'next/navigation';
import { TransactionSettingsScreen } from '@/components/settings/transaction-settings/TransactionSettingsScreen';
import {
  DOCUMENT_TYPE_SLUG,
  TRANSACTION_SETTINGS_CONTEXT,
  type TransactionDocumentType,
} from '@/lib/transaction-settings/types';

export default function ManufacturingTransactionSettingsPage() {
  const params = useParams<{ documentType: string }>();
  const documentType: TransactionDocumentType | undefined =
    DOCUMENT_TYPE_SLUG[String(params.documentType ?? '')];

  if (!documentType || TRANSACTION_SETTINGS_CONTEXT[documentType].module !== 'manufacturing') {
    notFound();
  }

  return <TransactionSettingsScreen documentType={documentType} />;
}
