'use client';

import { useState } from 'react';
import { Percent } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { percentInputToRate, rateToPercentInput } from '@/lib/subcontracts/money';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type DeductionDef = {
  id: string;
  code: string;
  nameAr: string;
  deductionRate: number | string;
  accountId?: string | null;
  account?: { id: string; code: string; arabicName: string } | null;
};

type FormState = {
  code: string;
  nameAr: string;
  ratePct: string;
  accountId: string;
};

const emptyForm = (): FormState => ({
  code: '',
  nameAr: '',
  ratePct: '0',
  accountId: '',
});

export default function ContractDeductionDefinitionPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const createMutation = useApiMutation<DeductionDef, Record<string, unknown>>(
    '/extracts/contract-deduction-definitions',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ تعريف الخصم');
        invalidateQuery(['contract-deduction-definitions']);
        invalidateQuery(['contract-deduction-definitions-browse']);
        handleCancel();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر الحفظ'),
    }
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('no id');
      return apiClient.put(`/extracts/contract-deduction-definitions/${selectedId}`, payload());
    },
    onSuccess: () => {
      setSuccess('تم تحديث تعريف الخصم');
      invalidateQuery(['contract-deduction-definitions']);
      invalidateQuery(['contract-deduction-definitions-browse']);
    },
    onError: (err: Error) => setError(err.message || 'تعذر التحديث'),
  });

  const payload = () => ({
    code: form.code.trim(),
    nameAr: form.nameAr.trim(),
    deductionRate: percentInputToRate(form.ratePct),
    accountId: form.accountId || null,
  });

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!form.code.trim() || !form.nameAr.trim()) {
      setError('الكود واسم الخصم مطلوبان');
      return;
    }
    if (selectedId) updateMutation.mutate();
    else createMutation.mutate(payload());
  };

  const loadRow = (row: DeductionDef) => {
    setSelectedId(row.id);
    setForm({
      code: row.code,
      nameAr: row.nameAr,
      ratePct: rateToPercentInput(row.deductionRate),
      accountId: row.accountId ?? row.account?.id ?? '',
    });
  };

  const handleCancel = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setError('');
    setSuccess('');
  };

  const savePending = createMutation.isPending || updateMutation.isPending;

  return (
    <ExtractsPageChrome
      title="تعريف الخصومات"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'تعريف الخصومات' },
      ]}
      onSave={handleSave}
      savePending={savePending}
      onNew={handleCancel}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      favoriteHref="/extracts/operations/contract-deduction-definition"
      currentId={selectedId}
      browseList={{
        title: 'تعريفات الخصومات',
        apiPath: '/extracts/contract-deduction-definitions',
        listKey: 'contract-deduction-definitions-browse',
        selectedId,
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.code || r.id) },
          { id: 'name', header: 'الخصم', getValue: (r) => String(r.nameAr || '—') },
        ],
        onSelect: (_id, row) => loadRow(row as DeductionDef),
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard
        title={selectedId ? 'تعديل خصم' : 'خصم جديد'}
        subtitle="يُستخدم في تعاقد العميل — خصومات المستخلص"
        icon={Percent}
      >
        <CompactFormField
          label="الكود"
          required
          value={form.code}
          onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
          placeholder="مثل RET-03"
        />
        <CompactFormField
          label="اسم الخصم"
          required
          value={form.nameAr}
          onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
          placeholder="مثل تأمين أعمال"
        />
        <CompactFormField
          label="نسبة الخصم %"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={form.ratePct}
          onChange={(e) => setForm((p) => ({ ...p, ratePct: e.target.value }))}
        />
        <CompactFormField label="الحساب" className="sm:col-span-2">
          <AccountSelect
            value={form.accountId || null}
            onChange={(id) => setForm((p) => ({ ...p, accountId: id ?? '' }))}
            placeholder="اختر حساب الخصم"
          />
        </CompactFormField>
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
