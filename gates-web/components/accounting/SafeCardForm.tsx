'use client';

import { useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { useAccountsQuery } from '@/lib/hooks/useMasterDataQueries';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { useApiQuery } from '@/lib/hooks/useApi';

export type SafeCardValues = {
  arabicName: string;
  code: string;
  englishName: string;
  currencyCode: string;
  parentAccountId: string;
};

export const EMPTY_SAFE_CARD: SafeCardValues = {
  arabicName: '',
  code: '',
  englishName: '',
  currencyCode: 'EGP',
  parentAccountId: '',
};

/** Default GL parent for a new treasury: «النقدية وما في حكمها» (parent of 1111). */
export function useTreasuryParentAccountId(enabled = true) {
  const { data: settingsRes } = useAccountingSettingsQuery();
  const cashId = settingsRes?.data?.accounts?.cashAccountId ?? '';
  const { data: headersRes } = useAccountsQuery('', 500, { headerOnly: true, enabled });
  const headers = headersRes?.data ?? [];

  const cashParentFromTree = headers.find((row) => row.code === '111')?.id ?? '';
  const cashDetail = settingsRes?.data?.accountDetails?.cashAccountId;
  if (cashParentFromTree) return cashParentFromTree;
  if (cashDetail?.code === '111') return cashDetail.id;
  if (cashId) {
    const asHeader = headers.find((row) => row.id === cashId);
    if (asHeader) return asHeader.id;
  }
  return headers.find((row) => /نقدية/.test(row.arabicName || ''))?.id ?? '';
}

export function SafeCardFields({
  values,
  onChange,
  autoFocusName = true,
}: {
  values: SafeCardValues;
  onChange: (patch: Partial<SafeCardValues>) => void;
  autoFocusName?: boolean;
}) {
  const defaultParentId = useTreasuryParentAccountId();
  const { data: currenciesRes } = useApiQuery<{ id: string; code: string; arabicName: string }[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesRes?.data ?? [];

  useEffect(() => {
    if (values.parentAccountId || !defaultParentId) return;
    onChange({ parentAccountId: defaultParentId });
  }, [defaultParentId, onChange, values.parentAccountId]);

  return (
    <FormSectionCard title="البيانات الأساسية" subtitle="نفس بطاقة الخزنة" icon={Wallet}>
      <CompactFormField
        label="اسم الخزنة"
        required
        value={values.arabicName}
        onChange={(e) => onChange({ arabicName: e.target.value })}
        autoFocus={autoFocusName}
      />
      <CompactFormField
        label="الكود (اختياري)"
        value={values.code}
        onChange={(e) => onChange({ code: e.target.value })}
      />
      <CompactFormField
        label="الاسم الإنجليزي"
        value={values.englishName}
        onChange={(e) => onChange({ englishName: e.target.value })}
      />
      <CompactFormField
        label="الحساب الأب"
        required
        hint="الخزنة الجديدة بتنزل تحت حساب النقدية — مش تحت حساب حركة."
      >
        <AccountSelect
          value={values.parentAccountId}
          onChange={(id) => onChange({ parentAccountId: id })}
          headerOnly
          leafOnly={false}
          placeholder="حساب النقدية"
          emptyLabel="اختَر حساب النقدية"
          enableQuickCreate={false}
        />
      </CompactFormField>
      <CompactFormField label="العملة">
        <select
          className={compactControlClass}
          value={values.currencyCode}
          onChange={(e) => onChange({ currencyCode: e.target.value })}
        >
          <option value="EGP">جنيه مصري</option>
          {currencies.map((currency) => (
            <option key={currency.id} value={currency.code}>
              {currency.arabicName}
            </option>
          ))}
        </select>
      </CompactFormField>
    </FormSectionCard>
  );
}
