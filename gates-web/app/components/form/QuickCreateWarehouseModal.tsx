'use client';

import React, { useEffect, useState } from 'react';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiMutation } from '@/lib/hooks/useApi';
import { invalidateMasterDataClient } from '@/lib/hooks/invalidateMasterData';
import type { ApiError } from '@/lib/api/types';
import type { WarehouseOption } from '@/lib/hooks/useMasterDataQueries';
import { useQueryClient } from '@tanstack/react-query';
import { QuickCreateDialog } from '@/app/components/form/QuickCreateDialog';

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

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCode('');
    setError('');
  }, [open, initialName]);

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
        <CompactFormField
          label="اسم المخزن"
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
