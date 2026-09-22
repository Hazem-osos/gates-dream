'use client';

import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';

type BankRow = { id: string; arabicName: string; code?: string | null };
type BankAccountRow = { id: string; arabicName: string; code?: string | null };

export default function BankAccountCardPage() {
  const invalidateQuery = useInvalidateQuery();
  const quickCreate = useQuickCreateHost('bank-account');
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();
  const [arabicName, setArabicName] = useState('');
  const [bankId, setBankId] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: banksRes } = useApiQuery<BankRow[]>(
    ['banks', { limit: 100 }],
    '/accounting/banks',
    { limit: 100, isActive: true }
  );
  const banks = banksRes?.data ?? [];

  useEffect(() => {
    if (!quickCreate.prefillName) return;
    setArabicName((prev) => prev || quickCreate.prefillName);
  }, [quickCreate.prefillName]);

  const accountMutation = useApiMutation<BankAccountRow, Record<string, unknown>>(
    '/accounting/bank-accounts',
    'POST',
    { showSuccessToast: false }
  );

  const handleSave = async () => {
    setError('');
    if (!arabicName.trim()) {
      setError('اسم الحساب البنكي مطلوب');
      return;
    }
    setSaving(true);
    try {
      let resolvedBankId = bankId;
      if (!resolvedBankId) {
        if (!newBankName.trim()) {
          setError(banks.length ? 'اختر البنك أو اكتب اسم بنك جديد' : 'اسم البنك مطلوب');
          setSaving(false);
          return;
        }
        const created = await apiClient.post<BankRow>('/accounting/banks', {
          arabicName: newBankName.trim(),
        });
        resolvedBankId = created.data?.id || '';
        if (!resolvedBankId) {
          setError('تعذر إنشاء البنك');
          setSaving(false);
          return;
        }
      }
      const res = await accountMutation.mutateAsync({
        bankId: resolvedBankId,
        arabicName: arabicName.trim(),
        currencyCode: companyBaseCurrency,
      });
      const row = res.data;
      if (!row?.id) {
        setError('تعذر إنشاء الحساب البنكي');
        return;
      }
      invalidateQuery(['bank-accounts']);
      invalidateQuery(['banks']);
      quickCreate.complete({
        id: row.id,
        label: entityLabel(row.code, row.arabicName || arabicName.trim()),
        arabicName: row.arabicName || arabicName.trim(),
        code: row.code,
      });
      setSuccess('تم حفظ الحساب البنكي');
      setArabicName('');
      setBankId('');
      setNewBankName('');
    } catch (err) {
      setError((err as ApiError).message || 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MasterCardShell
      title="بطاقة حساب بنكي"
      breadcrumbs={[
        { label: 'الحسابات', href: '/accounting' },
        { label: 'البطاقات' },
        { label: 'حساب بنكي' },
      ]}
      docNumber="جديد"
      statusLabel="جديد"
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      favoriteHref="/accounting/cards/bank-account"
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <FormSectionCard title="البيانات الأساسية" icon={Landmark}>
        <CompactFormField
          label="اسم الحساب البنكي"
          required
          value={arabicName}
          onChange={(e) => setArabicName(e.target.value)}
          autoFocus
        />
        {banks.length > 0 ? (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">البنك</span>
            <select
              className={compactControlClass}
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
            >
              <option value="">بنك جديد…</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.arabicName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!bankId ? (
          <CompactFormField
            label={banks.length ? 'اسم البنك الجديد' : 'اسم البنك'}
            required
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
          />
        ) : null}
      </FormSectionCard>
    </MasterCardShell>
  );
}
