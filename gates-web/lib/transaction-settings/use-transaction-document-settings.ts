'use client';

import { useEffect } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import {
  isTransactionSerialAutomatic,
  isTransactionSerialManual,
} from '@/lib/transaction-settings/serial-mode';
import type { TransactionDocumentType, TransactionSettings } from '@/lib/transaction-settings/types';

export function useTransactionDocumentSettings(documentType?: TransactionDocumentType) {
  const { data: settingsRes, isLoading } = useApiQuery<TransactionSettings>(
    ['transaction-settings', documentType ?? 'none'],
    documentType ? `/transaction-settings/${documentType}` : '/transaction-settings/SALES_INVOICE',
    undefined,
    { enabled: Boolean(documentType) }
  );
  const settings = settingsRes?.data;
  const autoPostOnSave = settings?.autoPostOnSave === true;
  const autoPrintOnSave = settings?.autoPrintOnSave === true;
  const serialAutomatic = isTransactionSerialAutomatic(settings?.numberingMode);
  const serialManual = isTransactionSerialManual(settings?.numberingMode);
  const saveLabel = autoPostOnSave ? STORE_SAVE_AND_POST_LABEL : 'حفظ';

  return {
    settings,
    isLoading,
    autoPostOnSave,
    autoPrintOnSave,
    serialAutomatic,
    serialManual,
    saveLabel,
    defaultWarehouseId: settings?.defaultWarehouseId ?? null,
  };
}

/** يملأ المخزن الافتراضي على مستند جديد فقط. */
export function useApplyDefaultWarehouseFromTransactionSettings(input: {
  selectedId: string | null;
  warehouseId: string;
  defaultWarehouseId: string | null | undefined;
  setWarehouseId: (id: string) => void;
}) {
  useEffect(() => {
    if (input.selectedId || !input.defaultWarehouseId || input.warehouseId) return;
    input.setWarehouseId(input.defaultWarehouseId);
  }, [
    input.defaultWarehouseId,
    input.selectedId,
    input.setWarehouseId,
    input.warehouseId,
  ]);
}
