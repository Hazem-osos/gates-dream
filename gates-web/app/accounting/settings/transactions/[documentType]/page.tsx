'use client';

import { notFound } from 'next/navigation';
import { useParams } from 'next/navigation';
import { TransactionSettingsScreen } from '@/components/settings/transaction-settings/TransactionSettingsScreen';
import {
  DOCUMENT_TYPE_SLUG,
  TRANSACTION_SETTINGS_CONTEXT,
  type TransactionDocumentType,
} from '@/lib/transaction-settings/types';

export default function AccountingTransactionSettingsPage() {
  const params = useParams<{ documentType: string }>();
  const slug = String(params.documentType ?? '');
  const documentType: TransactionDocumentType | undefined = DOCUMENT_TYPE_SLUG[slug];

  if (!documentType || TRANSACTION_SETTINGS_CONTEXT[documentType].module !== 'accounting') {
    notFound();
  }

  return <TransactionSettingsScreen documentType={documentType} />;
}
