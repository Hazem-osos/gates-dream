'use client';

import { useCallback, useState } from 'react';
import {
  extrasFromApi,
  extrasToApi,
  type InvoiceAdjustmentApiRow,
  type InvoiceExtraRow,
  validateInvoiceExtrasForSave,
} from '@/lib/invoices/invoice-adjustments';

export function useInvoiceExtras() {
  const [invoiceExtras, setInvoiceExtras] = useState<InvoiceExtraRow[]>([]);
  const [extrasOpen, setExtrasOpen] = useState(false);

  const loadAdjustments = useCallback((adjustments: InvoiceAdjustmentApiRow[] | undefined | null) => {
    const loaded = extrasFromApi(adjustments);
    setInvoiceExtras(loaded);
    setExtrasOpen(false);
  }, []);

  const resetExtras = useCallback(() => {
    setInvoiceExtras([]);
    setExtrasOpen(false);
  }, []);

  const getExtrasPayload = useCallback(() => extrasToApi(invoiceExtras), [invoiceExtras]);

  const validateExtras = useCallback(
    () => validateInvoiceExtrasForSave(invoiceExtras),
    [invoiceExtras]
  );

  return {
    invoiceExtras,
    setInvoiceExtras,
    extrasOpen,
    setExtrasOpen,
    loadAdjustments,
    resetExtras,
    getExtrasPayload,
    validateExtras,
  };
}
