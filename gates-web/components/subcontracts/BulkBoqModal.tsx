'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormSectionCard, FormStickyFooter, compactControlClass } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import type { SubcontractDetail } from '@/lib/subcontracts/types';

type BoqDraftRow = {
  itemCode: string;
  descriptionAr: string;
  descriptionEn: string;
  unit: string;
  contractQuantity: string;
  unitPrice: string;
  maxAllowedQuantity: string;
};

const emptyRow = (): BoqDraftRow => ({
  itemCode: '',
  descriptionAr: '',
  descriptionEn: '',
  unit: 'م3',
  contractQuantity: '',
  unitPrice: '',
  maxAllowedQuantity: '',
});

export function BulkBoqModal({
  open,
  subcontractId,
  onClose,
  onSaved,
}: {
  open: boolean;
  subcontractId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<BoqDraftRow[]>([emptyRow()]);

  const mutation = useMutation({
    mutationFn: async () => {
      const items = rows
        .filter((row) => row.itemCode && row.descriptionAr && row.unit && row.contractQuantity && row.unitPrice)
        .map((row) => ({
          itemCode: row.itemCode.trim(),
          descriptionAr: row.descriptionAr.trim(),
          descriptionEn: row.descriptionEn.trim() || undefined,
          unit: row.unit.trim(),
          contractQuantity: Number(row.contractQuantity),
          unitPrice: Number(row.unitPrice),
          maxAllowedQuantity: row.maxAllowedQuantity ? Number(row.maxAllowedQuantity) : undefined,
        }));
      if (!items.length) throw new Error('أدخل بندًا واحدًا على الأقل');
      return apiClient.post<SubcontractDetail>(`/subcontracts/${subcontractId}/boq`, { items });
    },
    onSuccess: () => {
      notifyApiSuccess('تم حفظ بنود المقايسة');
      setRows([emptyRow()]);
      onSaved?.();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="p-5 pb-0">
          <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">إضافة / استيراد بنود BOQ</h2>
          <FormSectionCard
            title="بنود المقايسة"
            subtitle="كود البند والوصف والوحدة والكمية وسعر العقد"
            icon={ClipboardList}
            bodyClassName="lg:grid-cols-1"
            className="mb-0"
          >
            <div className="overflow-auto rounded-xl border border-[#E6F0F7]">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="bg-[#F6FBFD] text-[#094C6B]">
                    <th className="px-2 py-2">الكود</th>
                    <th className="px-2 py-2">الوصف عربي</th>
                    <th className="px-2 py-2">الوصف إنجليزي</th>
                    <th className="px-2 py-2">الوحدة</th>
                    <th className="px-2 py-2">الكمية</th>
                    <th className="px-2 py-2">سعر الوحدة</th>
                    <th className="px-2 py-2">الحد الأقصى</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      {(
                        [
                          ['itemCode', 'text'],
                          ['descriptionAr', 'text'],
                          ['descriptionEn', 'text'],
                          ['unit', 'text'],
                          ['contractQuantity', 'number'],
                          ['unitPrice', 'number'],
                          ['maxAllowedQuantity', 'number'],
                        ] as const
                      ).map(([field, type]) => (
                        <td key={field} className="px-2 py-2">
                          <Input
                            type={type}
                            className={compactControlClass}
                            value={row[field]}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((current, i) => (i === index ? { ...current, [field]: e.target.value } : current))
                              )
                            }
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={() => setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSectionCard>
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={() => mutation.mutate()}
          saveText="حفظ البنود"
          cancelText="إلغاء"
          saveLoading={mutation.isPending}
          respectPermissions={false}
          className="mt-0"
          extraActions={
            <Button variant="secondary" size="sm" iconStart={<Plus className="h-4 w-4" />} onClick={() => setRows((prev) => [...prev, emptyRow()])}>
              صف جديد
            </Button>
          }
        />
      </div>
    </div>
  );
}
