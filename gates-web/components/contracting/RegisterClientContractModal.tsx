'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { useCustomersQuery } from '@/lib/hooks/useMasterDataQueries';
import type { ClientContractDetail } from '@/lib/contracting/types';
import { percentInputToRate, toMoney } from '@/lib/subcontracts/money';

export function RegisterClientContractModal({
  open,
  projectId,
  defaultCustomerId,
  defaultValue,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  defaultCustomerId?: string | null;
  defaultValue?: string | number | null;
  onClose: () => void;
  onCreated: (contract: ClientContractDetail) => void;
}) {
  const customersQ = useCustomersQuery();
  const customers = customersQ.data?.data ?? [];
  const [form, setForm] = useState({
    contractNumber: '',
    clientCustomerId: defaultCustomerId ?? '',
    contractDate: new Date().toISOString().slice(0, 10),
    totalContractValue: defaultValue != null ? String(toMoney(defaultValue)) : '',
    advancePaymentAmount: '0',
    advanceRecoveryRate: '0',
    retentionRate: '5',
    engineeringStampsRate: '0.5',
  });

  const create = useMutation({
    mutationFn: async () =>
      apiClient.post<ClientContractDetail>('/contracting/client-billing/contracts', {
        projectId,
        contractNumber: form.contractNumber,
        clientCustomerId: form.clientCustomerId,
        contractDate: form.contractDate,
        totalContractValue: toMoney(form.totalContractValue),
        advancePaymentAmount: toMoney(form.advancePaymentAmount),
        advanceRecoveryRate: percentInputToRate(form.advanceRecoveryRate),
        retentionRate: percentInputToRate(form.retentionRate),
        engineeringStampsRate: percentInputToRate(form.engineeringStampsRate),
      }),
    onSuccess: (res) => {
      notifyApiSuccess('تم تسجيل عقد المالك');
      if (res.data) onCreated(res.data);
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#0E79AA]">تسجيل عقد المالك</h2>
        <Input placeholder="رقم العقد" value={form.contractNumber} onChange={(e) => setForm((p) => ({ ...p, contractNumber: e.target.value }))} />
        <select
          className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm"
          value={form.clientCustomerId}
          onChange={(e) => setForm((p) => ({ ...p, clientCustomerId: e.target.value }))}
        >
          <option value="">اختر العميل المالك</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.arabicName}
            </option>
          ))}
        </select>
        <Input type="date" value={form.contractDate} onChange={(e) => setForm((p) => ({ ...p, contractDate: e.target.value }))} />
        <Input type="number" min="0" placeholder="قيمة العقد" value={form.totalContractValue} onChange={(e) => setForm((p) => ({ ...p, totalContractValue: e.target.value }))} />
        <Input type="number" min="0" placeholder="الدفعة المقدمة" value={form.advancePaymentAmount} onChange={(e) => setForm((p) => ({ ...p, advancePaymentAmount: e.target.value }))} />
        <div className="grid grid-cols-3 gap-2">
          <Input type="number" min="0" placeholder="استرداد المقدمة %" value={form.advanceRecoveryRate} onChange={(e) => setForm((p) => ({ ...p, advanceRecoveryRate: e.target.value }))} />
          <Input type="number" min="0" placeholder="تأمين 5%" value={form.retentionRate} onChange={(e) => setForm((p) => ({ ...p, retentionRate: e.target.value }))} />
          <Input type="number" min="0" placeholder="دمغات 0.5%" value={form.engineeringStampsRate} onChange={(e) => setForm((p) => ({ ...p, engineeringStampsRate: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button isLoading={create.isPending} disabled={!form.contractNumber || !form.clientCustomerId} onClick={() => create.mutate()}>
            حفظ العقد
          </Button>
        </div>
      </div>
    </div>
  );
}
