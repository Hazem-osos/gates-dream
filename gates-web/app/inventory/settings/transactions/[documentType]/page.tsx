'use client';

import { useParams } from 'next/navigation';
import { TransactionSettingsScreen } from '@/components/settings/transaction-settings/TransactionSettingsScreen';
import {
  DOCUMENT_TYPE_SLUG,
  type TransactionDocumentType,
} from '@/lib/transaction-settings/types';

export default function InventoryTransactionSettingsPage() {
  const params = useParams<{ documentType: string }>();
  const documentType: TransactionDocumentType =
    DOCUMENT_TYPE_SLUG[String(params.documentType ?? '')] ?? 'SALES_INVOICE';

  return <TransactionSettingsScreen documentType={documentType} />;
}
