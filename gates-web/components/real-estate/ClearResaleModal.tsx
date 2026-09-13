'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatEgp, toMoney } from '@/lib/real-estate/format';
import type { UnitResaleTransfer } from '@/lib/real-estate/types';

function hasOverdue(transfer: UnitResaleTransfer): boolean {
  const today = Date.now();
  return (transfer.contract?.installments ?? []).some((row) => {
    if (row.status === 'PAID' || row.status === 'CANCELLED') return false;
    return toMoney(row.balance) > 0 && (row.status === 'OVERDUE' || new Date(row.dueDate).getTime() < today);
  });
}

export function ClearResaleModal({
  open,
  transfer,
  onClose,
  onSaved,
}: {
  open: boolean;
  transfer: UnitResaleTransfer | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [paymentRef, setPaymentRef] = useState('');
  const blocked = transfer ? hasOverdue(transfer) : false;

  const mutation = useMutation({
    mutationFn: async () => apiClient.post(`/real-estate/resale/${transfer!.id}/clear`, { paymentRef }),
    onSuccess: () => {
      notifyApiSuccess('تم تنفيذ التحويل وفك قفل إعادة البيع');
      setPaymentRef('');
      onSaved?.();
      onClose();
    },
  });

  if (!open || !transfer) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#0E79AA]">تصفية رسوم التنازل وتنفيذ التحويل</h2>
        <p className="text-sm text-slate-600">
          العقد {transfer.contract?.contractNumber} — من {transfer.seller?.arabicName} إلى {transfer.newBuyer?.arabicName}
        </p>
        <p className="text-sm font-semibold">رسوم التنازل: {formatEgp(transfer.assignmentFeeAmount)}</p>
        {blocked ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            يوجد أقساط متأخرة على العقد الحالي. سداد المتأخرات إلزامي قبل فك القفل وتنفيذ التحويل.
          </p>
        ) : (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">لا توجد أقساط متأخرة مانعة للتحويل.</p>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">مرجع سداد رسوم التنازل</span>
          <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="رقم إيصال / تحويل" />
        </label>
        <p className="text-xs text-slate-500">بعد التأكيد: يُفك resaleLock، يتحول العقد القديم إلى محوّل، ويُنشأ عقد للمشتري الجديد.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button isLoading={mutation.isPending} disabled={blocked || !paymentRef.trim()} onClick={() => mutation.mutate()}>
            تنفيذ التحويل
          </Button>
        </div>
      </div>
    </div>
  );
}
