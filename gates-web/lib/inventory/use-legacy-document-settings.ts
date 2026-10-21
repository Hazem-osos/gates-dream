'use client';

import { useEffect } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import type { LegacyDocumentProfileId, LegacyDocumentSettings } from '@/lib/inventory/legacy-document-settings-profiles';
import { isTransactionSerialAutomatic } from '@/lib/transaction-settings/serial-mode';

export function useLegacyDocumentSettings(profile: LegacyDocumentProfileId) {
  const { data: settingsRes, isLoading } = useApiQuery<LegacyDocumentSettings>(
    ['legacy-document-settings', profile],
    `/inventory/legacy-document-settings/${profile}`
  );
  const settings = settingsRes?.data;
  const autoPostOnSave = settings?.autoPostOnSave === true;
  const autoPrintOnSave = settings?.autoPrintOnSave === true;
  const serialAutomatic = isTransactionSerialAutomatic(settings?.numberingMode);
  const saveLabel = autoPostOnSave ? STORE_SAVE_AND_POST_LABEL : 'حفظ';

  return {
    settings,
    isLoading,
    autoPostOnSave,
    autoPrintOnSave,
    serialAutomatic,
    saveLabel,
    defaultWarehouseId: settings?.defaultWarehouseId ?? null,
  };
}

/** يملأ المخزن الافتراضي على مستند جديد فقط. */
export function useApplyDefaultWarehouseFromLegacySettings(input: {
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
