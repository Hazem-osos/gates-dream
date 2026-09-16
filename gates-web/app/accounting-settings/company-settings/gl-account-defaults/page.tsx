'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import { apiClient } from '@/lib/api/client';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { BookOpen, Users } from 'lucide-react';

/**
 * Legacy parity (foundation-account-slots): the ~30 `CompanySetting` GL
 * account slots reconciled in
 * `gates-backend/src/modules/accounting/data/legacy-account-slots.ts`.
 * Only the `direct-posting-account` slots are surfaced here — the
 * `coa-tree-scope-filter` ones only scope an account picker to a parent
 * COA node in legacy and are deferred to the document-conversion wave that
 * builds that picker.
 */
const DIRECT_POSTING_SLOTS: Array<{ webAlias: string; legacyKey: string; label: string }> = [
  { webAlias: 'boxesAccount', legacyKey: 'BoxesAccount', label: 'حساب الصناديق الافتراضي' },
  { webAlias: 'banksAccount', legacyKey: 'BanksAccount', label: 'حساب البنوك الافتراضي' },
  { webAlias: 'suppliersAccount', legacyKey: 'SuppliersAccount', label: 'حساب الموردين الافتراضي' },
  { webAlias: 'fixedAssetsAccount', legacyKey: 'FixedAssetsAccount', label: 'حساب الأصول الثابتة' },
  { webAlias: 'daribaManbaAccount', legacyKey: 'DaribaManbaAccount', label: 'حساب ضريبة الخصم من المنبع (دائن)' },
  { webAlias: 'daribaManbaAccountDebit', legacyKey: 'DaribaManbaAccountDebit', label: 'حساب ضريبة الخصم من المنبع (مدين)' },
  { webAlias: 'profitAccount', legacyKey: 'ProfitAccount', label: 'حساب أرباح العام الحالي / الأرباح المرحلة' },
  { webAlias: 'solafAccount', legacyKey: 'SolafAccount', label: 'حساب سلف الموظفين' },
  { webAlias: 'ohdaAccount', legacyKey: 'OhdaAccount', label: 'حساب عهدة الموظفين' },
  { webAlias: 'ehlakAccount', legacyKey: 'EhlakAccount', label: 'حساب إهلاك الأصول الثابتة' },
  { webAlias: 'itemLossAccount', legacyKey: 'ItemLossAccount', label: 'حساب هالك المخزون' },
  { webAlias: 'offerAccount', legacyKey: 'OfferAccount', label: 'حساب خصومات العروض والترويج' },
  { webAlias: 'marketingExpensesAccount', legacyKey: 'MarketingExpensesAccount', label: 'حساب مصروفات التسويق والعمولات' },
  { webAlias: 'salesTaxAccount', legacyKey: 'SalesTaxAccount', label: 'حساب ضريبة المبيعات' },
];

interface Branch {
  id: string;
  arabicName?: string;
  englishName?: string | null;
}

interface CompanySettingEntryRow {
  id: string;
  branchId: string | null;
  name: string;
  value: string;
}

export default function GlAccountDefaultsSettingsPage() {
  useBackendReachability();

  const router = useRouter();
  const { companyId } = useFirstCompany();
  const invalidate = useInvalidateQuery();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [defs, setDefs] = useState<Record<string, string>>({});
  /** Branch-scoped `CustomersAccount` overrides — legacy is branch-scoped (untbranchvariables.pas). Keyed by branchId; '' key = company-wide default. */
  const [customersAccountByBranch, setCustomersAccountByBranch] = useState<Record<string, string>>({});

  const { data: settingsRes } = useApiQuery<Record<string, unknown>>(
    ['company-settings', companyId ?? 'none', 'gl-account-defaults'],
    `/companies/${companyId}/settings`,
    undefined,
    { enabled: Boolean(companyId) }
  );

  const { data: branchesRes } = useApiQuery<Branch[]>(
    ['company-branches', companyId ?? 'none'],
    '/company/branches',
    undefined,
    { enabled: Boolean(companyId) }
  );
  const branches = useMemo(() => branchesRes?.data ?? [], [branchesRes?.data]);

  const { data: customersAccountRowsRes } = useApiQuery<CompanySettingEntryRow[]>(
    ['company-settings-entries', companyId ?? 'none', 'CustomersAccount'],
    '/company-settings',
    { prefix: 'CustomersAccount' },
    { enabled: Boolean(companyId) }
  );

  useEffect(() => {
    const ad = settingsRes?.data?.accountDefinitions;
    if (!ad || typeof ad !== 'object') return;
    const next: Record<string, string> = {};
    for (const slot of DIRECT_POSTING_SLOTS) {
      const v = (ad as Record<string, unknown>)[slot.webAlias];
      if (typeof v === 'string') next[slot.webAlias] = v;
    }
    setDefs(next);
  }, [settingsRes?.data]);

  useEffect(() => {
    const rows = customersAccountRowsRes?.data ?? [];
    const byBranch: Record<string, string> = {};
    for (const row of rows) {
      if (row.name !== 'CustomersAccount') continue;
      byBranch[row.branchId ?? ''] = row.value;
    }
    setCustomersAccountByBranch(byBranch);
  }, [customersAccountRowsRes?.data]);

  const saveAccountDefsMutation = useMutation({
    mutationFn: (accountDefinitions: Record<string, unknown>) => {
      if (!companyId) throw new Error('لا توجد شركة');
      return apiClient.put(`/companies/${companyId}/settings`, { accountDefinitions });
    },
    onSuccess: () => {
      setSuccess('تم حفظ الحسابات الافتراضية للنظام');
      setError('');
      invalidate(['company-settings']);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'فشل الحفظ');
      setSuccess('');
    },
  });

  const saveCustomersAccountMutation = useMutation({
    mutationFn: async ({ branchId, value }: { branchId: string; value: string }) => {
      if (!companyId) throw new Error('لا توجد شركة');
      if (!value) {
        return apiClient.delete('/company-settings/CustomersAccount', branchId ? { branchId } : undefined);
      }
      return apiClient.put('/company-settings/CustomersAccount', {
        value,
        branchId: branchId || null,
      });
    },
    onSuccess: () => {
      setSuccess('تم حفظ حساب العملاء');
      setError('');
      invalidate(['company-settings-entries']);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'فشل الحفظ');
      setSuccess('');
    },
  });

  const handleSaveAll = () => {
    setError('');
    setSuccess('');
    if (!companyId) {
      setError('لا توجد شركة');
      return;
    }
    const existing = settingsRes?.data?.accountDefinitions;
    const accountDefinitions = {
      ...(typeof existing === 'object' && existing ? existing : {}),
      ...defs,
    };
    saveAccountDefsMutation.mutate(accountDefinitions);
  };

  const handleBack = () => router.back();

  const filledSlotCount = DIRECT_POSTING_SLOTS.filter((slot) => String(defs[slot.webAlias] ?? '').trim()).length;

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: 'rtl' }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 text-right">
          <h1 className="mb-1 text-lg font-bold text-[#0E78AA]">الحسابات الافتراضية للنظام</h1>
          <div className="h-1 w-full rounded bg-sky-700" />
        </div>

        <FormSectionCard
          title="حساب العملاء الافتراضي"
          subtitle="يمكن تخصيصه لكل فرع"
          icon={Users}
          bodyClassName="space-y-3"
        >
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(8rem,12rem)_1fr_auto]">
            <span className="pb-2 text-xs font-semibold text-slate-600">افتراضي الشركة</span>
            <AccountSelect
              className={compactControlClass}
              value={customersAccountByBranch[''] ?? ''}
              onChange={(accountId) =>
                setCustomersAccountByBranch((prev) => ({ ...prev, '': accountId }))
              }
              headerOnly
              leafOnly={false}
              placeholder="اختر حساب العملاء الرئيسي"
            />
            <button
              type="button"
              onClick={() =>
                saveCustomersAccountMutation.mutate({
                  branchId: '',
                  value: customersAccountByBranch[''] ?? '',
                })
              }
              className="h-9 rounded-lg bg-[#0E78AA] px-3 text-xs font-semibold text-white hover:bg-[#0A5F87]"
            >
              حفظ
            </button>
          </div>
          {branches.map((b) => (
            <div key={b.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(8rem,12rem)_1fr_auto]">
              <span className="pb-2 text-xs font-semibold text-slate-600">{b.arabicName || b.id}</span>
              <AccountSelect
                className={compactControlClass}
                value={customersAccountByBranch[b.id] ?? ''}
                onChange={(accountId) =>
                  setCustomersAccountByBranch((prev) => ({ ...prev, [b.id]: accountId }))
                }
                emptyLabel="— بدون تخصيص (يستخدم افتراضي الشركة) —"
                headerOnly
                leafOnly={false}
                placeholder="اختر حساب العملاء الرئيسي"
              />
              <button
                type="button"
                onClick={() =>
                  saveCustomersAccountMutation.mutate({
                    branchId: b.id,
                    value: customersAccountByBranch[b.id] ?? '',
                  })
                }
                className="h-9 rounded-lg bg-[#0E78AA] px-3 text-xs font-semibold text-white hover:bg-[#0A5F87]"
              >
                حفظ
              </button>
            </div>
          ))}
        </FormSectionCard>

        <AdvancedFieldsSection title="حسابات النظام الافتراضية الأخرى" badgeCount={filledSlotCount} defaultOpen>
          <FormSectionCard icon={BookOpen} bodyClassName="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DIRECT_POSTING_SLOTS.map((slot) => {
              const controlSlot = slot.webAlias === 'suppliersAccount';
              return (
              <CompactFormField key={slot.webAlias} label={slot.label}>
                <AccountSelect
                  className={compactControlClass}
                  value={defs[slot.webAlias] ?? ''}
                  onChange={(accountId) =>
                    setDefs((prev) => ({ ...prev, [slot.webAlias]: accountId }))
                  }
                  headerOnly={controlSlot}
                  leafOnly={!controlSlot}
                  placeholder={controlSlot ? 'اختر حساباً رئيسياً' : 'اختر حساب حركة'}
                />
              </CompactFormField>
              );
            })}
          </FormSectionCard>
        </AdvancedFieldsSection>

        <FormStickyFooter
          onSave={handleSaveAll}
          onCancel={handleBack}
          saveLoading={saveAccountDefsMutation.isPending}
        />

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      </div>
    </div>
  );
}
