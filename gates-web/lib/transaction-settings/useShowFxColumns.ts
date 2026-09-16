'use client';

import { useCallback, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import type { TransactionDocumentType, TransactionSettings } from '@/lib/transaction-settings/types';

export function useShowFxColumns(documentType: TransactionDocumentType) {
  const { data } = useApiQuery<TransactionSettings>(
    ['transaction-settings', documentType],
    `/transaction-settings/${documentType}`
  );
  const settingOn = data?.data?.showFxColumns !== false;
  const [override, setOverride] = useState<boolean | null>(null);

  const showFx = override ?? settingOn;
  const setShowFx = useCallback((next: boolean) => {
    setOverride(next);
  }, []);
  const resetFxToSetting = useCallback(() => {
    setOverride(null);
  }, []);

  return { showFx, setShowFx, resetFxToSetting, settingOn };
}
