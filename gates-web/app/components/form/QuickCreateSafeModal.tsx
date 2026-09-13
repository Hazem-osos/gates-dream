'use client';

import React, { useEffect, useState } from 'react';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import { QuickCreateDialog } from '@/app/components/form/QuickCreateDialog';

export type QuickCreatedSafe = {
  id: string;
  arabicName: string;
  code?: string | null;
};

type Props = {
  open: boolean;
  initialName?: string;
  currencyCode?: string;
  onClose: () => void;
  onCreated: (safe: QuickCreatedSafe) => void;
};

export function QuickCreateSafeModal({
  open,
  initialName = '',
  currencyCode = 'EGP',
  onClose,
  onCreated,
}: Props) {
  const invalidate = useInvalidateQuery();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCode('');
    setError('');
  }, [open, initialName]);

  const mutation = useApiMutation<QuickCreatedSafe, Record<string, unknown>>(
    '/accounting/safes',
    'POST',
    {
      showSuccessToast: true,
      successMessage: 'تم إنشاء الخزنة',
      onSuccess: (res) => {
        const row = res.data;
        if (!row?.id) return;
        invalidate(['safes']);
        onCreated({
          id: row.id,
          arabicName: row.arabicName || name.trim(),
          code: row.code ?? code.trim() || null,
        });
        onClose();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر الحفظ'),
    }
  );

  const submit = () => {
    setError('');
    if (!name.trim()) {
      setError('الاسم مطلوب');
      return;
    }
    mutation.mutate({
      arabicName: name.trim(),
      code: code.trim() || undefined,
      currencyCode,
    });
  };

  return (
    <QuickCreateDialog
      open={open}
      title="إضافة خزنة جديدة"
      titleId="quick-safe-title"
      error={error}
      saving={mutation.isPending}
      onClose={onClose}
      onSave={submit}
    >
      <FormSectionCard title="البيانات الأساسية" bodyClassName="sm:grid-cols-1 lg:grid-cols-1">
        <CompactFormField
          label="اسم الخزنة"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <CompactFormField label="الكود (اختياري)" value={code} onChange={(e) => setCode(e.target.value)} />
      </FormSectionCard>
    </QuickCreateDialog>
  );
}
