'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatEgp, percentInputToRate, toMoney } from '@/lib/subcontracts/money';

export function RecordSiteStockModal({
  open,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    materialDescription: '',
    deliveryDate: new Date().toISOString().slice(0, 10),
    warehouseReceiptRef: '',
    deliveredQuantity: '',
    unitPrice: '',
    approvedPercentage: '75',
  });
  const net = toMoney(form.deliveredQuantity) * toMoney(form.unitPrice) * percentInputToRate(form.approvedPercentage);

  const create = useMutation({
    mutationFn: async () =>
      apiClient.post(`/contracting/client-billing/projects/${projectId}/site-stock`, {
        materialDescription: form.materialDescription,
        deliveryDate: form.deliveryDate,
        warehouseReceiptRef: form.warehouseReceiptRef || undefined,
        deliveredQuantity: toMoney(form.deliveredQuantity),
        unitPrice: toMoney(form.unitPrice),
        approvedPercentage: percentInputToRate(form.approvedPercentage),
      }),
    onSuccess: () => {
      notifyApiSuccess('تم تسجيل تشوين الموقع');
      onCreated();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#0E79AA]">تسجيل تشوين بالموقع</h2>
        <Input placeholder="وصف الخامة" value={form.materialDescription} onChange={(e) => setForm((p) => ({ ...p, materialDescription: e.target.value }))} />
        <Input type="date" value={form.deliveryDate} onChange={(e) => setForm((p) => ({ ...p, deliveryDate: e.target.value }))} />
        <Input placeholder="رقم إذن التسليم / الاستلام" value={form.warehouseReceiptRef} onChange={(e) => setForm((p) => ({ ...p, warehouseReceiptRef: e.target.value }))} />
        <div className="grid grid-cols-3 gap-2">
          <Input type="number" min="0" placeholder="الكمية" value={form.deliveredQuantity} onChange={(e) => setForm((p) => ({ ...p, deliveredQuantity: e.target.value }))} />
          <Input type="number" min="0" placeholder="سعر الوحدة" value={form.unitPrice} onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))} />
          <Input type="number" min="0" max="100" placeholder="نسبة الاعتماد %" value={form.approvedPercentage} onChange={(e) => setForm((p) => ({ ...p, approvedPercentage: e.target.value }))} />
        </div>
        <p className="rounded-lg bg-[#F6FBFD] px-3 py-2 text-sm">
          صافي المطالبة المعتمدة: <span className="font-bold tabular-nums text-[#0E79AA]">{formatEgp(net)}</span>
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button isLoading={create.isPending} disabled={!form.materialDescription} onClick={() => create.mutate()}>
            حفظ التشوين
          </Button>
        </div>
      </div>
    </div>
  );
}
