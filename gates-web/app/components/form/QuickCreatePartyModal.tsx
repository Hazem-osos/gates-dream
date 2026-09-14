'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButtons, CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError, ApiResponse } from '@/lib/api/types';
import type { PartyOption } from '@/lib/hooks/useMasterDataQueries';

type QuickCreatePartyModalProps = {
  open: boolean;
  kind: 'CUSTOMER' | 'SUPPLIER';
  initialName: string;
  onClose: () => void;
  onCreated: (party: { id: string; arabicName: string; code?: string | null }) => void;
};

function prependPartyListCache(
  queryClient: ReturnType<typeof useQueryClient>,
  listKey: 'customers' | 'suppliers',
  row: PartyOption
) {
  queryClient.setQueriesData<ApiResponse<PartyOption[]>>(
    { queryKey: [listKey] },
    (old) => {
      if (!old?.data) return old;
      if (old.data.some((p) => p.id === row.id)) return old;
      return { ...old, data: [row, ...old.data] };
    }
  );
}

export function QuickCreatePartyModal({
  open,
  kind,
  initialName,
  onClose,
  onCreated,
}: QuickCreatePartyModalProps) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateQuery();
  const [name, setName] = useState(initialName);
  const [mobile, setMobile] = useState('');
  const [taxId, setTaxId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setMobile('');
      setTaxId('');
      setOpeningBalance('');
      setError('');
    }
  }, [open, initialName]);

  const endpoint =
    kind === 'CUSTOMER' ? '/accounting/customers' : '/accounting/suppliers';
  const cacheKey = kind === 'CUSTOMER' ? ['customers'] : ['suppliers'];

  const mutation = useApiMutation<
    { id: string; arabicName: string; code?: string | null },
    Record<string, unknown>
  >(endpoint, 'POST', {
      showSuccessToast: true,
      successMessage: kind === 'CUSTOMER' ? 'تم إنشاء العميل' : 'تم إنشاء المورد',
      onSuccess: (res) => {
        const row = res.data;
        if (row?.id) {
          const partyRow: PartyOption = {
            id: row.id,
            arabicName: row.arabicName ?? name.trim(),
            code: row.code ?? null,
          };
          prependPartyListCache(
            queryClient,
            kind === 'CUSTOMER' ? 'customers' : 'suppliers',
            partyRow
          );
          invalidate(cacheKey);
          invalidate(['accounts']);
          invalidate(['chart-of-accounts']);
          onCreated(partyRow);
          onClose();
        }
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر الحفظ'),
    }
  );

  if (!open) return null;

  const submit = () => {
    setError('');
    if (!name.trim()) {
      setError('الاسم مطلوب');
      return;
    }
    const body: Record<string, unknown> = {
      arabicName: name.trim(),
      mobile: mobile.trim() || undefined,
      taxAuthority: taxId.trim() || undefined,
    };
    if (openingBalance.trim()) {
      const n = Number(openingBalance);
      if (Number.isFinite(n) && n > 0) {
        body.estimatedBudget = n;
      }
    }
    mutation.mutate(body);
  };

  const title = kind === 'CUSTOMER' ? 'إضافة عميل سريع' : 'إضافة مورد سريع';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-party-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 id="quick-party-title" className="mb-4 text-lg font-bold text-[#0A3D5E]">
          {title}
        </h2>
        <FormSectionCard title="البيانات الأساسية" bodyClassName="sm:grid-cols-1 lg:grid-cols-1">
          <CompactFormField
            label="الاسم"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <CompactFormField label="الموبايل" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          <CompactFormField
            label="الرقم الضريبي (اختياري)"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
          />
          <CompactFormField
            label="رصيد افتتاحي (اختياري)"
            type="number"
            min={0}
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </FormSectionCard>
        <div className="mt-2">
          <ActionButtons
            onCancel={onClose}
            onSave={submit}
            saveText={mutation.isPending ? 'جاري الحفظ…' : 'حفظ'}
            cancelText="إلغاء"
            saveDisabled={mutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
