'use client';

import React, { useEffect, useState } from 'react';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import { QuickCreateDialog } from '@/app/components/form/QuickCreateDialog';

export type QuickCreatedBankAccount = {
  id: string;
  arabicName: string;
  code?: string | null;
};

type BankRow = { id: string; arabicName: string; code?: string | null };

type Props = {
  open: boolean;
  initialName?: string;
  currencyCode?: string;
  onClose: () => void;
  onCreated: (bankAccount: QuickCreatedBankAccount) => void;
};

export function QuickCreateBankAccountModal({
  open,
  initialName = '',
  currencyCode = 'EGP',
  onClose,
  onCreated,
}: Props) {
  const invalidate = useInvalidateQuery();
  const [name, setName] = useState(initialName);
  const [bankId, setBankId] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: banksRes } = useApiQuery<BankRow[]>(
    ['banks', { limit: 100 }],
    '/accounting/banks',
    { limit: 100, isActive: true },
    { enabled: open }
  );
  const banks = banksRes?.data ?? [];

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setBankId('');
    setNewBankName('');
    setError('');
    setSaving(false);
  }, [open, initialName]);

  const accountMutation = useApiMutation<QuickCreatedBankAccount, Record<string, unknown>>(
    '/accounting/bank-accounts',
    'POST',
    { showSuccessToast: false }
  );

  const submit = async () => {
    setError('');
    if (!name.trim()) {
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
        arabicName: name.trim(),
        currencyCode,
      });
      const row = res.data;
      if (!row?.id) {
        setError('تعذر إنشاء الحساب البنكي');
        setSaving(false);
        return;
      }
      invalidate(['bank-accounts']);
      invalidate(['banks']);
      onCreated({
        id: row.id,
        arabicName: row.arabicName || name.trim(),
        code: row.code ?? null,
      });
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <QuickCreateDialog
      open={open}
      title="إضافة حساب بنكي جديد"
      titleId="quick-bank-account-title"
      error={error}
      saving={saving}
      onClose={onClose}
      onSave={() => void submit()}
    >
      <FormSectionCard title="البيانات الأساسية" bodyClassName="sm:grid-cols-1 lg:grid-cols-1">
        <CompactFormField
          label="اسم الحساب البنكي"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
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
    </QuickCreateDialog>
  );
}
