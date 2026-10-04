'use client';

import { useState } from 'react';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { Button } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

export function LandedCostPanel({ invoiceId, posted }: { invoiceId?: string; posted: boolean }) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [pending, setPending] = useState(false);
  if (!posted || !invoiceId) return null;

  const allocate = async () => {
    const total = Number(amount);
    if (!(total > 0) || !accountId) {
      toast.error('أدخل قيمة التكلفة وحساب المصروف');
      return;
    }
    setPending(true);
    try {
      const created = await apiClient.post<{ id: string }>('/inventory/landed-costs', {
        invoiceId,
        date: new Date().toISOString(),
        totalAmount: total,
        expenseAccountId: accountId,
        description: 'تكاليف إضافية على فاتورة المشتريات',
      });
      const id = created.data?.id;
      if (id) await apiClient.post(`/inventory/landed-costs/${id}/post`, {});
      toast.success('تم توزيع التكلفة الإضافية على متوسط تكلفة الأصناف');
      setAmount('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ التكلفة الإضافية');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-[#D6EAF3] bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#0A3D5E]">تكاليف إضافية</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-[#0A3D5E]">
          القيمة
          <input
            className="mt-1 block rounded-lg border border-[#D6EAF3] px-3 py-2"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <div className="min-w-64">
          <AccountSelect value={accountId} onChange={setAccountId} />
        </div>
        <Button type="button" disabled={pending} onClick={() => void allocate()}>
          توزيع وترحيل
        </Button>
      </div>
    </section>
  );
}
