'use client';

import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { staleTimes } from '@/lib/query/query-keys';
import type {
  AccountingSettingsFacade,
  AccountingSettingsPutBody,
} from '@/lib/accounting-settings/accounting-settings.types';

export const ACCOUNTING_SETTINGS_QUERY_KEY = ['accounting-settings'] as const;

export function useAccountingSettingsQuery() {
  return useApiQuery<AccountingSettingsFacade>(
    ACCOUNTING_SETTINGS_QUERY_KEY,
    '/accounting/settings',
    undefined,
    { staleTime: staleTimes.masterMs }
  );
}

/** Canonical Phase-3 hook name — same as `useAccountingSettingsQuery`. */
export function useAccountingSettings() {
  return useAccountingSettingsQuery();
}

export function useAccountingSettingsMutation() {
  const invalidate = useInvalidateQuery();
  return useApiMutation<AccountingSettingsFacade, AccountingSettingsPutBody>(
    '/accounting/settings',
    'PUT',
    {
      successMessage: 'تم حفظ إعدادات المحاسبة',
      onSuccess: () => {
        invalidate(ACCOUNTING_SETTINGS_QUERY_KEY);
        invalidate(['gl-defaults']);
        invalidate(['company-settings']);
      },
    }
  );
}

/** Canonical Phase-3 mutation name — same as `useAccountingSettingsMutation`. */
export function useUpdateAccountingSettings() {
  return useAccountingSettingsMutation();
}
