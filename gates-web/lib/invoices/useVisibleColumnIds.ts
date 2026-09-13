'use client';

import { useEffect, useState } from 'react';
import {
  getDefaultVisibleColumnIds,
  loadVisibleColumnIds,
  type InvoiceColumnStorageKey,
  type InvoiceLineColumnId,
} from '@/lib/invoices/invoiceLineColumns';

/**
 * Column visibility for invoice line grids. Initial render matches SSR (defaults only);
 * localStorage preferences apply after mount to avoid hydration mismatch.
 */
export function useVisibleColumnIds(storageKey: InvoiceColumnStorageKey, companyId?: string | null) {
  const [visibleColumnIds, setVisibleColumnIds] = useState<InvoiceLineColumnId[]>(() =>
    getDefaultVisibleColumnIds(storageKey)
  );

  useEffect(() => {
    setVisibleColumnIds(loadVisibleColumnIds(storageKey, companyId));
  }, [storageKey, companyId]);

  return [visibleColumnIds, setVisibleColumnIds] as const;
}
