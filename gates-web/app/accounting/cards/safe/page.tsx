'use client';

import { useCallback, useEffect, useState } from 'react';
import { MasterCardShell } from '@/components/erp';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { bumpTrailingCode } from '@/lib/masters/nextNumericSerial';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';
import {
  EMPTY_SAFE_CARD,
  SafeCardFields,
  type SafeCardValues,
} from '@/components/accounting/SafeCardForm';

type SafeRow = {
  id: string;
  arabicName: string;
  code?: string | null;
};

export default function SafeCardPage() {
  const invalidateQuery = useInvalidateQuery();
  const quickCreate = useQuickCreateHost('safe');
  const [values, setValues] = useState<SafeCardValues>({ ...EMPTY_SAFE_CARD });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!quickCreate.prefillName) return;
    setValues((prev) => (prev.arabicName ? prev : { ...prev, arabicName: quickCreate.prefillName }));
  }, [quickCreate.prefillName]);

  const patch = useCallback((next: Partial<SafeCardValues>) => {
    setValues((prev) => ({ ...prev, ...next }));
  }, []);

  const mutation = useApiMutation<SafeRow, Record<string, unknown>>('/accounting/safes', 'POST', {
    onSuccess: (res) => {
      const created = res?.data;
      if (created?.id) {
        quickCreate.complete({
          id: created.id,
          label: entityLabel(created.code, created.arabicName),
          arabicName: created.arabicName,
          code: created.code,
        });
      }
      invalidateQuery(['safes']);
      setSuccess('تم حفظ الخزنة — تقدر تضيف التالي');
      setValues((prev) => ({
        ...EMPTY_SAFE_CARD,
        parentAccountId: prev.parentAccountId,
        currencyCode: prev.currencyCode,
        code: bumpTrailingCode(created?.code ?? ''),
      }));
    },
    onError: (err: ApiError) => setError(err.message || 'تعذر حفظ الخزنة'),
  });

  const handleSave = () => {
    setError('');
    if (!values.arabicName.trim()) {
      setError('اسم الخزنة مطلوب');
      return;
    }
    if (!values.parentAccountId) {
      setError('اختَر الحساب الأب (النقدية)');
      return;
    }
    mutation.mutate({
      arabicName: values.arabicName.trim(),
      code: values.code.trim() || undefined,
      englishName: values.englishName.trim() || undefined,
      currencyCode: values.currencyCode || 'EGP',
      parentAccountId: values.parentAccountId,
    });
  };

  return (
    <MasterCardShell
      title="بطاقة خزنة"
      breadcrumbs={[
        { label: 'الحسابات', href: '/accounting' },
        { label: 'البطاقات' },
        { label: 'خزنة' },
      ]}
      docNumber={values.code || 'جديد'}
      statusLabel="جديد"
      onSave={handleSave}
      savePending={mutation.isPending}
      canSave={!mutation.isPending}
      favoriteHref="/accounting/cards/safe"
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <SafeCardFields values={values} onChange={patch} />
    </MasterCardShell>
  );
}
