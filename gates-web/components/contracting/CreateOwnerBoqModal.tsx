'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { resolveOwnerBoqCreatePayload } from '@/lib/contracting/mostakhlasat-contracts';
import type { BoqItemUnit } from '@/lib/contracting/types';
import { toMoney } from '@/lib/subcontracts/money';

const UNITS = Object.keys(BOQ_UNIT_LABEL) as BoqItemUnit[];

export function CreateOwnerBoqModal({
  open,
  projectId,
  existingItems = [],
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  existingItems?: Array<{ id: string; itemCode: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const existingCodes = existingItems.map((row) => row.itemCode);
  const [form, setForm] = useState({
    parentCode: '',
    itemCode: '',
    descriptionAr: '',
    descriptionEn: '',
    notes: '',
    unit: 'M2' as BoqItemUnit,
    contractQuantity: '',
  });
  const [localError, setLocalError] = useState('');

  const parentOptions = useMemo(() => {
    const unique = Array.from(new Set(existingCodes.map((c) => c.trim()).filter(Boolean)));
    return unique.sort();
  }, [existingCodes]);

  const resolvedCode = form.parentCode
    ? `${form.parentCode}.${form.itemCode.replace(/^[.\-\/]+/, '')}`
    : form.itemCode.trim();

  const duplicate = existingCodes.some((code) => code.trim() === resolvedCode);

  useEffect(() => {
    if (!open) return;
    setForm({
      parentCode: '',
      itemCode: '',
      descriptionAr: '',
      descriptionEn: '',
      notes: '',
      unit: 'M2',
      contractQuantity: '',
    });
    setLocalError('');
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      const parsed = resolveOwnerBoqCreatePayload({
        parentCode: form.parentCode,
        itemCode: form.itemCode,
        descriptionAr: form.descriptionAr,
        descriptionEn: form.descriptionEn,
        notes: form.notes,
        unit: form.unit,
        contractQuantity: toMoney(form.contractQuantity),
        existingItems,
      });
      if (parsed.ok === false) {
        setLocalError(parsed.error);
        throw new Error(parsed.error);
      }
      return apiClient.post(`/contracting/technical-office/projects/${projectId}/boq`, {
        itemCode: parsed.itemCode,
        descriptionAr: parsed.descriptionAr,
        descriptionEn: parsed.descriptionEn,
        notes: parsed.notes,
        parentId: parsed.parentId,
        isExecutable: parsed.parentId ? true : undefined,
        unit: parsed.unit,
        contractQuantity: parsed.contractQuantity,
      });
    },
    onSuccess: () => {
      notifyApiSuccess('تم إضافة بند المقايسة');
      onCreated();
      onClose();
    },
  });

  if (!open) return null;

  const saveDisabled =
    !form.itemCode.trim() || !form.descriptionAr.trim() || duplicate || create.isPending;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="p-5 pb-0">
          <h2 className="mb-4 text-lg font-bold text-[#0E78AA]">بند مقايسة مالك جديد</h2>
          {localError || create.error ? (
            <p className="mb-3 text-sm text-red-700">
              {localError || (create.error instanceof Error ? create.error.message : 'تعذر حفظ البند')}
            </p>
          ) : null}
          <FormSectionCard
            title="البيانات الأساسية"
            subtitle="كود هرمي (بند رئيسي / تنفيذي) والوصف والوحدة وكمية العقد"
            icon={ClipboardList}
            className="mb-0"
          >
            <CompactFormField label="البند الرئيسي (اختياري)">
              <select
                className={compactControlClass}
                value={form.parentCode}
                onChange={(e) => setForm((p) => ({ ...p, parentCode: e.target.value }))}
              >
                <option value="">— بند مستقل / رئيسي —</option>
                {parentOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="كود البند"
              required
              value={form.itemCode}
              onChange={(e) => setForm((p) => ({ ...p, itemCode: e.target.value }))}
              placeholder={form.parentCode ? 'مثل 1 أو 2' : 'مثل 1 أو 1.1'}
              hint={resolvedCode ? `الكود النهائي: ${resolvedCode}` : undefined}
            />
            <CompactFormField
              label="الوصف بالعربية"
              required
              value={form.descriptionAr}
              onChange={(e) => setForm((p) => ({ ...p, descriptionAr: e.target.value }))}
              placeholder="الوصف بالعربية"
            />
            <CompactFormField
              label="الوصف بالإنجليزية"
              value={form.descriptionEn}
              onChange={(e) => setForm((p) => ({ ...p, descriptionEn: e.target.value }))}
              placeholder="English description"
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
              step="0.001"
              value={form.contractQuantity}
              onChange={(e) => setForm((p) => ({ ...p, contractQuantity: e.target.value }))}
              placeholder="0 للبند الرئيسي التجميعي"
              hint="البنود الرئيسية غالباً بلا كمية تنفيذية — أدخل الكمية على البنود الفرعية."
            />
            <CompactFormField
              label="ملاحظات"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="ملاحظات البند"
              className="sm:col-span-2"
            />
          </FormSectionCard>
          {duplicate ? (
            <p className="mt-2 text-sm text-red-700">كود البند مستخدم مسبقاً في هذه المقايسة.</p>
          ) : null}
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => {
            setLocalError('');
            if (!form.itemCode.trim() || !form.descriptionAr.trim()) {
              setLocalError('كود البند والوصف العربي مطلوبان');
              return;
            }
            create.mutate();
          }}
          saveText="حفظ البند"
          cancelText="إلغاء"
          saveLoading={create.isPending}
          saveDisabled={saveDisabled}
          className="mt-0"
        />
      </div>
    </div>
  );
}
