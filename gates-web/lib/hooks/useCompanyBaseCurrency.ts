'use client';

import {
  FALLBACK_BASE_CURRENCY,
  currencyDisplayLabel,
} from '@/lib/accounting/fx-base';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';

export function useCompanyBaseCurrency() {
  const { data } = useAccountingSettingsQuery();
  const code = data?.data?.general?.defaultCurrency?.trim() || FALLBACK_BASE_CURRENCY;
  return { code, label: currencyDisplayLabel(code) };
}
