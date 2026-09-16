'use client';

import { useCallback, useEffect, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { FormStickyFooter } from '@/components/ui';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import {
  EMPTY_SAFE_CARD,
  SafeCardFields,
  type SafeCardValues,
} from '@/components/accounting/SafeCardForm';

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
  const [values, setValues] = useState<SafeCardValues>({
    ...EMPTY_SAFE_CARD,
    arabicName: initialName,
    currencyCode,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setValues({
      ...EMPTY_SAFE_CARD,
      arabicName: initialName,
      currencyCode,
    });
    setError('');
  }, [open, initialName, currencyCode]);

  const patch = useCallback((next: Partial<SafeCardValues>) => {
    setValues((prev) => ({ ...prev, ...next }));
  }, []);

  const mutation = useApiMutation<QuickCreatedSafe, Record<string, unknown>>(
    '/accounting/safes',
    'POST',
    {
      successMessage: 'تم حفظ الخزنة',
      onSuccess: (res) => {
        const row = res.data;
        if (!row?.id) return;
        invalidate(['safes']);
        onCreated({
          id: row.id,
          arabicName: row.arabicName || values.arabicName.trim(),
          code: row.code ?? (values.code.trim() || null),
        });
        onClose();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ الخزنة'),
    }
  );

  const submit = () => {
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
    <CenteredOverlay open={open} onClose={onClose} width="lg" labelledBy="safe-card-title">
      <div className="erp-field-wide flex min-h-0 w-full min-w-0 flex-1 flex-col" dir="rtl">
        <div className="min-w-0 flex-1 overflow-y-auto p-6 pb-2">
          <h2 id="safe-card-title" className="mb-4 text-xl font-bold text-[#0E79AA]">
            بطاقة خزنة
          </h2>
          <SafeCardFields values={values} onChange={patch} />
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={submit}
          saveLoading={mutation.isPending}
          cancelText="إلغاء"
          saveText="حفظ"
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </CenteredOverlay>
  );
}
