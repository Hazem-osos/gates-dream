'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { useItemsQuery } from '@/lib/hooks/useMasterDataQueries';
import { formatEgp, formatQty, toMoney } from '@/lib/subcontracts/money';
import { defaultOverheadRate, previewMaterialOveruse } from '@/lib/subcontracts/material-formula';
import type { MaterialReconciliation, SubcontractDetail } from '@/lib/subcontracts/types';

const emptyForm = {
  materialId: '',
  warehouseIssueSlipNumber: '',
  standardEngineeredQty: '',
  actualIssuedQty: '',
  marketPricePerUnit: '',
};

export function MaterialReconciliationModal({
  open,
  subcontract,
  onClose,
  onCreated,
}: {
  open: boolean;
  subcontract: SubcontractDetail;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const { data: itemsRes } = useItemsQuery(400);
  const items = itemsRes?.data ?? [];
  const scrapTolerance = toMoney(subcontract.standardScrapToleranceRate);
  const overheadRate = defaultOverheadRate(subcontract.contractAdminOverheadRate);

  const preview = useMemo(
    () =>
      previewMaterialOveruse({
        standardEngineeredQty: toMoney(form.standardEngineeredQty),
        actualIssuedQty: toMoney(form.actualIssuedQty),
        marketPricePerUnit: toMoney(form.marketPricePerUnit),
        scrapToleranceRate: scrapTolerance,
        adminOverheadRate: overheadRate,
      }),
    [form, overheadRate, scrapTolerance]
  );

  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post<MaterialReconciliation>(`/subcontracts/${subcontract.id}/material-reconciliation`, {
        materialId: form.materialId,
        warehouseIssueSlipNumber: form.warehouseIssueSlipNumber || undefined,
        standardEngineeredQty: Number(form.standardEngineeredQty),
        actualIssuedQty: Number(form.actualIssuedQty),
        marketPricePerUnit: Number(form.marketPricePerUnit),
      }),
    onSuccess: () => {
      notifyApiSuccess('تم تسجيل تسوية الهوالك');
      setForm(emptyForm);
      onCreated?.();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-xl space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#0E79AA]">تسوية هوالك خامات الموقع</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">الخامة</span>
          <select
            className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm"
            value={form.materialId}
            onChange={(e) => setForm((prev) => ({ ...prev, materialId: e.target.value }))}
          >
            <option value="">اختر الصنف</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code ? `${item.code} — ` : ''}
                {item.arabicName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">رقم إذن صرف المخزن</span>
          <Input
            value={form.warehouseIssueSlipNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, warehouseIssueSlipNumber: e.target.value }))}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">الكمية الهندسية القياسية</span>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={form.standardEngineeredQty}
              onChange={(e) => setForm((prev) => ({ ...prev, standardEngineeredQty: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">الكمية المصروفة فعليًا</span>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={form.actualIssuedQty}
              onChange={(e) => setForm((prev) => ({ ...prev, actualIssuedQty: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">سعر السوق</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.marketPricePerUnit}
              onChange={(e) => setForm((prev) => ({ ...prev, marketPricePerUnit: e.target.value }))}
            />
          </label>
        </div>
        <div className="rounded-xl bg-[#F6FBFD] p-3 text-sm">
          <p className="mb-2 font-semibold text-[#094C6B]">
            Excess Qty = Actual − (Standard × (1 + ScrapTolerance))
          </p>
          <div className="grid grid-cols-2 gap-2">
            <span>حد التسامح: {formatQty(preview.allowedThreshold)}</span>
            <span>الزيادة: {formatQty(preview.excessQty)}</span>
            <span>قيمة الزيادة: {formatEgp(preview.rawPenalty)}</span>
            <span>أعباء إدارية {Math.round(overheadRate * 100)}٪: {formatEgp(preview.overheadAmount)}</span>
          </div>
          <p className="mt-2 font-bold text-[#0E79AA]">إجمالي الخصم: {formatEgp(preview.totalDeduction)}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={!form.materialId || !form.standardEngineeredQty || !form.actualIssuedQty || !form.marketPricePerUnit}
            onClick={() => mutation.mutate()}
          >
            حفظ التسوية
          </Button>
        </div>
      </div>
    </div>
  );
}
