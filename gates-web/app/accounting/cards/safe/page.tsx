'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { bumpTrailingCode } from '@/lib/masters/nextNumericSerial';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';

type SafeRow = {
  id: string;
  arabicName: string;
  code?: string | null;
};

export default function SafeCardPage() {
  const invalidateQuery = useInvalidateQuery();
  const quickCreate = useQuickCreateHost('safe');
  const [arabicName, setArabicName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!quickCreate.prefillName) return;
    setArabicName((prev) => prev || quickCreate.prefillName);
  }, [quickCreate.prefillName]);

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
      setArabicName('');
      setCode(bumpTrailingCode(created?.code ?? ''));
    },
    onError: (err: ApiError) => setError(err.message || 'تعذر حفظ الخزنة'),
  });

  const handleSave = () => {
    setError('');
    if (!arabicName.trim()) {
      setError('اسم الخزنة مطلوب');
      return;
    }
    mutation.mutate({
      arabicName: arabicName.trim(),
      code: code.trim() || undefined,
      currencyCode: 'EGP',
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
      docNumber={code || 'جديد'}
      statusLabel="جديد"
      onSave={handleSave}
      savePending={mutation.isPending}
      canSave={!mutation.isPending}
      favoriteHref="/accounting/cards/safe"
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <FormSectionCard title="البيانات الأساسية" icon={Wallet}>
        <CompactFormField
          label="اسم الخزنة"
          required
          value={arabicName}
          onChange={(e) => setArabicName(e.target.value)}
          autoFocus
        />
        <CompactFormField label="الكود (اختياري)" value={code} onChange={(e) => setCode(e.target.value)} />
      </FormSectionCard>
    </MasterCardShell>
  );
}
