'use client';

import { useEffect, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { Settings2 } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { useMutation } from '@tanstack/react-query';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type ContractorOption = {
  id: string;
  serial?: string | null;
  arabicName?: string;
};

type ContractorSettings = {
  advancePaymentPercentage?: number | string | null;
  workInsurancePercentage?: number | string | null;
  taxDeductionPercentage?: number | string | null;
  otherSettings?: {
    contractorAccountId?: string;
  } | null;
};

function pctStr(v: number | string | null | undefined): string {
  if (v == null || v === '') return '';
  return String(v);
}

export default function ExtractContractorSettingsPage() {
  useBackendReachability();
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [advancePaymentPercentage, setAdvancePaymentPercentage] = useState('');
  const [workInsurancePercentage, setWorkInsurancePercentage] = useState('');
  const [taxDeductionPercentage, setTaxDeductionPercentage] = useState('');
  const [contractorAccountId, setContractorAccountId] = useState('');

  const { data: contractorsRes } = useApiQuery<ContractorOption[]>(
    ['contractors', 'settings-picker'],
    '/extracts/contractors',
    { limit: 500, isActive: true }
  );
  const contractors = contractorsRes?.data ?? [];

  const { data: settingsRes, isFetching: settingsLoading } = useApiQuery<ContractorSettings | null>(
    ['contractor-settings', contractorId],
    `/extracts/contractors/${contractorId}/settings`,
    undefined,
    { enabled: Boolean(contractorId) }
  );

  useEffect(() => {
    if (!contractorId) {
      setAdvancePaymentPercentage('');
      setWorkInsurancePercentage('');
      setTaxDeductionPercentage('');
      setContractorAccountId('');
      return;
    }
    const s = settingsRes?.data;
    setAdvancePaymentPercentage(pctStr(s?.advancePaymentPercentage));
    setWorkInsurancePercentage(pctStr(s?.workInsurancePercentage));
    setTaxDeductionPercentage(pctStr(s?.taxDeductionPercentage));
    setContractorAccountId(s?.otherSettings?.contractorAccountId ?? '');
  }, [contractorId, settingsRes?.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!contractorId) throw new Error('يرجى اختيار المقاول');
      const parsePct = (raw: string) => {
        if (!raw.trim()) return null;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          throw new Error('النسب يجب أن تكون بين 0 و 100');
        }
        return n;
      };
      const otherSettings: Record<string, string> = {
        ...(settingsRes?.data?.otherSettings && typeof settingsRes.data.otherSettings === 'object'
          ? (settingsRes.data.otherSettings as Record<string, string>)
          : {}),
      };
      if (contractorAccountId) {
        otherSettings.contractorAccountId = contractorAccountId;
      } else {
        delete otherSettings.contractorAccountId;
      }
      return apiClient.put(`/extracts/contractors/${contractorId}/settings`, {
        advancePaymentPercentage: parsePct(advancePaymentPercentage),
        workInsurancePercentage: parsePct(workInsurancePercentage),
        taxDeductionPercentage: parsePct(taxDeductionPercentage),
        otherSettings,
      });
    },
    onSuccess: () => {
      setSuccess('تم حفظ إعدادات المقاول');
      setError('');
      invalidateQuery(['contractor-settings', contractorId]);
    },
    onError: (err: ApiError) => {
      setError(err.message || 'تعذر حفظ الإعدادات');
    },
  });

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!contractorId) {
      setError('يرجى اختيار المقاول');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <ExtractsPageChrome
      title="إعدادات المستخلصات و المقاولات"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'إعدادات المستخلصات و المقاولات' },
      ]}
      onSave={handleSave}
      savePending={saveMutation.isPending || settingsLoading}
      canSave={Boolean(contractorId)}
      onNew={() => {
        setContractorId('');
        setSuccess('');
        setError('');
      }}
      statusLabel="إعدادات"
      favoriteHref="/extracts/operations/extract-contractor-settings"
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="المقاول" subtitle="اختر المقاول ثم عدّل نسبه وحسابه" icon={Settings2}>
        <CompactFormField label="المقاول" required className="sm:col-span-2">
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            className={compactControlClass}
          >
            <option value="">— اختر مقاولاً —</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.arabicName || c.serial || c.id}
              </option>
            ))}
          </select>
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="الحسابات" subtitle="حساب المقاول المستخدم عند ترحيل السداد">
        <CompactFormField label="حساب المقاولين" className="sm:col-span-2">
          <AccountSelect
            value={contractorAccountId}
            onChange={(id) => setContractorAccountId(id)}
            disabled={!contractorId}
            placeholder="اختر حساب المقاول"
          />
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="النسب" subtitle="حقول ContractorSettings الفعلية">
        <CompactFormField
          label="نسبة الدفعة المقدمة %"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={advancePaymentPercentage}
          onChange={(e) => setAdvancePaymentPercentage(e.target.value)}
          disabled={!contractorId}
        />
        <CompactFormField
          label="نسبة تأمين الأعمال %"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={workInsurancePercentage}
          onChange={(e) => setWorkInsurancePercentage(e.target.value)}
          disabled={!contractorId}
        />
        <CompactFormField
          label="نسبة الضرائب المستقطعة %"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={taxDeductionPercentage}
          onChange={(e) => setTaxDeductionPercentage(e.target.value)}
          disabled={!contractorId}
        />
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
