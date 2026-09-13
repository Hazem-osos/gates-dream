'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import {
  CompactFormField,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { BOQ_UNIT_LABEL } from '@/lib/contracting/labels';
import type { BoqItemUnit } from '@/lib/contracting/types';
import { toMoney } from '@/lib/subcontracts/money';

const UNITS = Object.keys(BOQ_UNIT_LABEL) as BoqItemUnit[];

export function CreateOwnerBoqModal({
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
    itemCode: '',
    descriptionAr: '',
    unit: 'M2' as BoqItemUnit,
    contractQuantity: '',
  });

  const create = useMutation({
    mutationFn: async () =>
      apiClient.post(`/contracting/technical-office/projects/${projectId}/boq`, {
        itemCode: form.itemCode,
        descriptionAr: form.descriptionAr,
        unit: form.unit,
        contractQuantity: toMoney(form.contractQuantity),
      }),
    onSuccess: () => {
      notifyApiSuccess('تم إضافة بند المقايسة');
      onCreated();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="p-5 pb-0">
          <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">بند مقايسة مالك جديد</h2>
          <FormSectionCard
            title="البيانات الأساسية"
            subtitle="كود البند والوصف والوحدة وكمية العقد"
            icon={ClipboardList}
            className="mb-0"
          >
            <CompactFormField
              label="كود البند"
              required
              value={form.itemCode}
              onChange={(e) => setForm((p) => ({ ...p, itemCode: e.target.value }))}
              placeholder="كود البند"
            />
            <CompactFormField
              label="الوصف بالعربية"
              required
              value={form.descriptionAr}
              onChange={(e) => setForm((p) => ({ ...p, descriptionAr: e.target.value }))}
              placeholder="الوصف بالعربية"
            />
            <CompactFormField label="الوحدة">
              <select
                className={compactControlClass}
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value as BoqItemUnit }))}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {BOQ_UNIT_LABEL[unit]}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="كمية العقد"
              type="number"
              min="0"
              value={form.contractQuantity}
              onChange={(e) => setForm((p) => ({ ...p, contractQuantity: e.target.value }))}
              placeholder="كمية العقد"
            />
          </FormSectionCard>
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => create.mutate()}
          saveText="حفظ البند"
          cancelText="إلغاء"
          saveLoading={create.isPending}
          saveDisabled={!form.itemCode || !form.descriptionAr}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
