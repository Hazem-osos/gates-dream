'use client';

import { useMemo } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  sourceTypesForLoadBar,
  type SelectableSourceType,
  type SourceLoadRole,
} from '@/lib/invoices/sourceDocument';
import { transactionAffectsStock } from '@/lib/transaction-settings/affect-stock';
import type { TransactionSettings } from '@/lib/transaction-settings/types';

export function useSourceTypesForDocument(opts: {
  currentAffectsStock: boolean;
  sourceRole?: SourceLoadRole;
  allowedTypes?: readonly SelectableSourceType[];
}): readonly SelectableSourceType[] {
  const needsInvoicePolicies = !opts.allowedTypes && (opts.sourceRole ?? 'general') === 'general';
  const { data: salesSettings } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'SALES_INVOICE'],
    '/transaction-settings/SALES_INVOICE',
    undefined,
    { enabled: needsInvoicePolicies }
  );
  const { data: purchaseSettings } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'PURCHASE_INVOICE'],
    '/transaction-settings/PURCHASE_INVOICE',
    undefined,
    { enabled: needsInvoicePolicies }
  );

  return useMemo(() => {
    if (opts.allowedTypes?.length) return opts.allowedTypes;
    return sourceTypesForLoadBar({
      role: opts.sourceRole,
      currentAffectsStock: opts.currentAffectsStock,
      policies: {
        salesInvoiceAffectsStock: transactionAffectsStock(salesSettings?.data),
        purchaseInvoiceAffectsStock: transactionAffectsStock(purchaseSettings?.data),
      },
    });
  }, [
    opts.allowedTypes,
    opts.currentAffectsStock,
    opts.sourceRole,
    purchaseSettings?.data,
    salesSettings?.data,
  ]);
}
