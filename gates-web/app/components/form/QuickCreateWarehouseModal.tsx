'use client';

import React, { useEffect, useState } from 'react';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import { invalidateMasterDataClient } from '@/lib/hooks/invalidateMasterData';
import type { ApiError } from '@/lib/api/types';
import type { WarehouseOption } from '@/lib/hooks/useMasterDataQueries';
import { useQueryClient } from '@tanstack/react-query';
import { QuickCreateDialog } from '@/app/components/form/QuickCreateDialog';
import { isCodeAfter } from '@/lib/masters/nextNumericSerial';

type Props = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (warehouse: WarehouseOption) => void;
};

export function QuickCreateWarehouseModal({ open, initialName, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const { data: nextCodeResponse } = useApiQuery<{ code?: string }>(
    ['warehouses', 'next-code', 'quick-root'],
    '/inventory/warehouses/next-code',
    undefined,
    { enabled: open }
  );

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError('');
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const suggested = nextCodeResponse?.data?.code;
    if (!suggested) return;
    setCode((prev) => (prev && isCodeAfter(prev, suggested) ? prev : suggested));
  }, [open, nextCodeResponse?.data?.code]);

  const mutation = useApiMutation<WarehouseOption, Record<string, unknown>>(
    '/inventory/warehouses',
    'POST',
    {
      showSuccessToast: true,
      successMessage: 'تم إنشاء المخزن',
      onSuccess: (res) => {
        const row = res.data;
        if (!row?.id) return;
        invalidateMasterDataClient(queryClient);
        onCreated({
          id: row.id,
          arabicName: row.arabicName || name.trim(),
          code: row.code ?? (code.trim() || null),
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
      warehouseKind: 'POSTING',
    });
  };

  return (
    <QuickCreateDialog
      open={open}
      title="إضافة مخزن جديد"
      titleId="quick-warehouse-title"
      error={error}
      saving={mutation.isPending}
      onClose={onClose}
      onSave={submit}
    >
      <FormSectionCard title="البيانات الأساسية" bodyClassName="sm:grid-cols-1 lg:grid-cols-1">
        <CompactFormField label="المسلسل" value={code} disabled placeholder="يُولَّد تلقائياً…" />
        <CompactFormField
          label="اسم المخزن"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </FormSectionCard>
    </QuickCreateDialog>
  );
}
