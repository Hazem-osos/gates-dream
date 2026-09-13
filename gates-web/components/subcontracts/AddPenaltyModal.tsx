'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import type { SitePenalty, SitePenaltyType } from '@/lib/subcontracts/types';

const PENALTY_TYPES: Array<{ value: SitePenaltyType; label: string }> = [
  { value: 'DELAY_PENALTY', label: 'غرامة تأخير' },
  { value: 'NCR_QUALITY_DEFECT', label: 'عيب جودة (NCR)' },
  { value: 'HSE_SAFETY_VIOLATION', label: 'مخالفة سلامة' },
  { value: 'MANPOWER_SHORTAGE', label: 'نقص عمالة' },
  { value: 'EQUIPMENT_DEMURRAGE', label: 'غرامة معدات / ديمرج' },
];

const emptyForm = {
  penaltyType: 'DELAY_PENALTY' as SitePenaltyType,
  amount: '',
  incidentDate: '',
  description: '',
  consultantReportRef: '',
  approveForDeduction: true,
};

export function AddPenaltyModal({
  open,
  subcontractId,
  onClose,
  onCreated,
}: {
  open: boolean;
  subcontractId: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [form, setForm] = useState(emptyForm);

  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post<SitePenalty>(`/subcontracts/${subcontractId}/penalties`, {
        penaltyType: form.penaltyType,
        amount: Number(form.amount),
        incidentDate: form.incidentDate,
        description: form.description,
        consultantReportRef: form.consultantReportRef || undefined,
        approveForDeduction: form.approveForDeduction,
      }),
    onSuccess: () => {
      notifyApiSuccess('تم تسجيل الغرامة');
      setForm(emptyForm);
      onCreated?.();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#0E79AA]">إضافة غرامة موقع</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">نوع الغرامة</span>
          <select
            className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm"
            value={form.penaltyType}
            onChange={(e) => setForm((prev) => ({ ...prev, penaltyType: e.target.value as SitePenaltyType }))}
          >
            {PENALTY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">المبلغ</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">تاريخ الواقعة</span>
          <Input
            type="date"
            value={form.incidentDate}
            onChange={(e) => setForm((prev) => ({ ...prev, incidentDate: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">الوصف</span>
          <textarea
            className="min-h-20 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">مرجع تقرير الاستشاري</span>
          <Input
            value={form.consultantReportRef}
            onChange={(e) => setForm((prev) => ({ ...prev, consultantReportRef: e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.approveForDeduction}
            onChange={(e) => setForm((prev) => ({ ...prev, approveForDeduction: e.target.checked }))}
          />
          اعتماد للخصم فورًا من المستخلص التالي
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={!form.amount || !form.incidentDate || !form.description}
            onClick={() => mutation.mutate()}
          >
            حفظ الغرامة
          </Button>
        </div>
      </div>
    </div>
  );
}
