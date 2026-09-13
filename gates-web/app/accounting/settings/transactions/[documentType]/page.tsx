'use client';

import { useParams } from 'next/navigation';
import { TransactionSettingsScreen } from '@/components/settings/transaction-settings/TransactionSettingsScreen';
import {
  DOCUMENT_TYPE_SLUG,
  type TransactionDocumentType,
} from '@/lib/transaction-settings/types';

export default function AccountingTransactionSettingsPage() {
  const params = useParams<{ documentType: string }>();
  const documentType: TransactionDocumentType =
    DOCUMENT_TYPE_SLUG[String(params.documentType ?? '')] ?? 'PAYMENT_VOUCHER';

  return <TransactionSettingsScreen documentType={documentType} />;
}
