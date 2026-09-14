'use client';

import React, { useEffect, useState } from 'react';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiMutation } from '@/lib/hooks/useApi';
import { useSuggestAccountCode } from '@/lib/hooks/useChartOfAccounts';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { invalidateMasterDataClient } from '@/lib/hooks/invalidateMasterData';
import type { ApiError } from '@/lib/api/types';
import { useQueryClient } from '@tanstack/react-query';
import { QuickCreateDialog } from '@/app/components/form/QuickCreateDialog';

export type QuickCreatedAccount = {
  id: string;
  code: string;
  arabicName: string;
};

type Props = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (account: QuickCreatedAccount) => void;
};

export function QuickCreateAccountModal({ open, initialName, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [error, setError] = useState('');

  const { data: settingsRes } = useAccountingSettingsQuery();
  const autoNumbering = settingsRes?.data?.general?.coaAutoNumbering !== false;
  const { data: suggestRes } = useSuggestAccountCode(null, open);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCodeTouched(false);
    setError('');
  }, [open, initialName]);

  useEffect(() => {
    if (open && !codeTouched && suggestRes?.data?.code) {
      setCode(suggestRes.data.code);
    }
  }, [open, codeTouched, suggestRes?.data?.code]);

  const mutation = useApiMutation<QuickCreatedAccount, Record<string, unknown>>(
    '/accounting/accounts',
    'POST',
    {
      showSuccessToast: true,
      successMessage: 'تم إنشاء الحساب',
      onSuccess: (res) => {
        const row = res.data;
        if (!row?.id) return;
        invalidateMasterDataClient(queryClient);
        onCreated({
          id: row.id,
          code: row.code || code.trim(),
          arabicName: row.arabicName || name.trim(),
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
    if (!autoNumbering && !code.trim()) {
      setError('كود الحساب مطلوب — الترقيم يدوي');
      return;
    }
    mutation.mutate({
      arabicName: name.trim(),
      code: code.trim() || undefined,
    });
  };

  return (
    <QuickCreateDialog
      open={open}
      title="إضافة حساب جديد"
      titleId="quick-account-title"
      error={error}
      saving={mutation.isPending}
      onClose={onClose}
      onSave={submit}
    >
      <FormSectionCard title="البيانات الأساسية" bodyClassName="sm:grid-cols-1 lg:grid-cols-1">
        <CompactFormField
          label="اسم الحساب"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <CompactFormField
          label={autoNumbering ? 'الكود (تلقائي)' : 'الكود'}
          required={!autoNumbering}
          value={code}
          readOnly={autoNumbering}
          disabled={autoNumbering}
          onChange={(e) => {
            setCodeTouched(true);
            setCode(e.target.value);
          }}
        />
      </FormSectionCard>
    </QuickCreateDialog>
  );
}
