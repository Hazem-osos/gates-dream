'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormStickyFooter } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { toast } from '@/lib/feedback/toast';
import { ELEMENT_LABEL, ELEMENT_TYPES } from '@/lib/contracting/labels';
import { isOwnerBoqHeader, rateAnalysisSaveItems } from '@/lib/contracting/mostakhlasat-contracts';
import { previewRateAnalysisLineTotal } from '@/lib/contracting/rate-analysis-preview';
import type { BOQCostElementType, OwnerBoqItem, RateAnalysisItem } from '@/lib/contracting/types';
import { formatEgp, percentInputToRate, rateToPercentInput, toMoney } from '@/lib/subcontracts/money';

type Line = {
  key: string;
  costElementType: BOQCostElementType;
  resourceCode: string;
  descriptionAr: string;
  unit: string;
  consumptionQuotaPerUnit: string;
  unitCost: string;
  wasteFactorPct: string;
  notes: string;
};

function fromItem(item: RateAnalysisItem, index: number): Line {
  return {
    key: item.id || `row-${index}`,
    costElementType: item.costElementType,
    resourceCode: item.resourceCode ?? '',
    descriptionAr: item.descriptionAr ?? '',
    unit: item.unit ?? '',
    consumptionQuotaPerUnit: String(toMoney(item.consumptionQuotaPerUnit)),
    unitCost: String(toMoney(item.unitCost)),
    wasteFactorPct: rateToPercentInput(item.wasteFactorRate),
    notes: item.notes ?? '',
  };
}

function emptyLine(type: BOQCostElementType): Line {
  return {
    key: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    costElementType: type,
    resourceCode: '',
    descriptionAr: ELEMENT_LABEL[type],
    unit: '',
    consumptionQuotaPerUnit: '0',
    unitCost: '0',
    wasteFactorPct: '0',
    notes: '',
  };
}

function previewTotal(line: Line): number {
  return previewRateAnalysisLineTotal({
    consumptionQuotaPerUnit: toMoney(line.consumptionQuotaPerUnit),
    wasteFactorRate: percentInputToRate(line.wasteFactorPct),
    unitCost: toMoney(line.unitCost),
  });
}

export function RateAnalysisDrawer({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: OwnerBoqItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const seed = useMemo(() => {
    const existing = item?.rateAnalysisItems ?? [];
    if (existing.length) return existing.map(fromItem);
    return ELEMENT_TYPES.map(emptyLine);
  }, [item]);
  const [lines, setLines] = useState<Line[]>(seed);

  useEffect(() => {
    setLines(seed);
  }, [seed]);

  const save = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error('missing item');
      if (isOwnerBoqHeader(item)) {
        toast.error('تحليل السعر للبنود التنفيذية فقط');
        throw new Error('تحليل السعر للبنود التنفيذية فقط');
      }
      const invalidWaste = lines.find((line) => {
        const pct = toMoney(line.wasteFactorPct);
        return pct < 0 || pct > 100;
      });
      if (invalidWaste) {
        toast.error('نسبة الهالك يجب أن تكون بين 0 و 100');
        throw new Error('نسبة الهالك يجب أن تكون بين 0 و 100');
      }
      const items = rateAnalysisSaveItems(
        lines.map((line) => ({
          costElementType: line.costElementType,
          resourceCode: line.resourceCode,
          descriptionAr: line.descriptionAr || ELEMENT_LABEL[line.costElementType],
          unit: line.unit,
          consumptionQuotaPerUnit: toMoney(line.consumptionQuotaPerUnit),
          unitCost: toMoney(line.unitCost),
          wasteFactorRate: percentInputToRate(line.wasteFactorPct),
          notes: line.notes,
        }))
      ).map(({ previewTotal: _previewTotal, ...rest }) => rest);
      if (!items.length) {
        toast.error('أدخل سطر تكلفة واحداً على الأقل');
        throw new Error('أدخل سطر تكلفة واحداً على الأقل');
      }
      return apiClient.post(`/contracting/technical-office/boq/${item.id}/rate-analysis`, { items });
    },
    onSuccess: () => {
      notifyApiSuccess('تم حفظ تحليل السعر');
      onSaved();
      onClose();
    },
  });

  if (!item) return null;

  const totalDirect = lines.reduce((sum, line) => sum + previewTotal(line), 0);
  const byType = ELEMENT_TYPES.map((type) => ({
    type,
    total: lines.filter((line) => line.costElementType === type).reduce((sum, line) => sum + previewTotal(line), 0),
  })).filter((row) => row.total > 0);

  const update = (key: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="xl">
      <header className="flex items-center justify-between border-b border-[#E6F0F7] px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-[#0E78AA]">تحليل السعر — {item.itemCode}</h2>
          <p className="text-sm text-slate-500">{item.descriptionAr}</p>
          {isOwnerBoqHeader(item) ? (
            <p className="mt-1 text-xs text-amber-800">البند الرئيسي لا يُحلَّل — افتح بنداً تنفيذياً.</p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="إغلاق">
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 overflow-auto p-5">
        <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
          <table className="w-full min-w-[1100px] text-center text-xs">
            <thead>
              <tr className="bg-[#F6FBFD] text-[#094C6B]">
                <th className="px-2 py-2">العنصر</th>
                <th className="px-2 py-2">كود المورد</th>
                <th className="px-2 py-2">المورد / الوصف</th>
                <th className="px-2 py-2">الوحدة</th>
                <th className="px-2 py-2">معدل الاستهلاك</th>
                <th className="px-2 py-2">تكلفة الوحدة</th>
                <th className="px-2 py-2">نسبة الهالك %</th>
                <th className="px-2 py-2">إجمالي السطر (معاينة)</th>
                <th className="px-2 py-2">ملاحظات</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-t border-slate-100">
                  <td className="px-2 py-2">
                    <select
                      className="h-8 w-full rounded-lg border border-[#D6EAF3] bg-white px-2"
                      value={line.costElementType}
                      onChange={(e) => update(line.key, { costElementType: e.target.value as BOQCostElementType })}
                    >
                      {ELEMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {ELEMENT_LABEL[type]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <Input value={line.resourceCode} onChange={(e) => update(line.key, { resourceCode: e.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input value={line.descriptionAr} onChange={(e) => update(line.key, { descriptionAr: e.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input value={line.unit} onChange={(e) => update(line.key, { unit: e.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={line.consumptionQuotaPerUnit}
                      onChange={(e) => update(line.key, { consumptionQuotaPerUnit: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitCost}
                      onChange={(e) => update(line.key, { unitCost: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={line.wasteFactorPct}
                      onChange={(e) => update(line.key, { wasteFactorPct: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 tabular-nums font-semibold">{formatEgp(previewTotal(line))}</td>
                  <td className="px-2 py-2">
                    <Input value={line.notes} onChange={(e) => update(line.key, { notes: e.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <Button size="sm" variant="ghost" onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}>
                      حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            iconStart={<Plus className="h-4 w-4" />}
            onClick={() => setLines((prev) => [...prev, emptyLine('MATERIAL')])}
          >
            إضافة مورد / سطر تكلفة
          </Button>
          <div className="rounded-xl bg-[#F0F7FB] px-4 py-3 text-sm">
            <span className="text-slate-500">معاينة إجمالي التكلفة المباشرة للوحدة = </span>
            <span className="font-bold tabular-nums text-[#0E78AA]">{formatEgp(totalDirect)}</span>
            <p className="mt-1 text-xs text-slate-500">
              استهلاك × (1 + الهالك) × تكلفة الوحدة — القيمة المحفوظة على السيرفر هي المعتمدة بعد الحفظ.
            </p>
            {byType.length ? (
              <ul className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-[#094C6B] sm:grid-cols-3">
                {byType.map((row) => (
                  <li key={row.type}>
                    {ELEMENT_LABEL[row.type]}: {formatEgp(row.total)}
                  </li>
                ))}
              </ul>
            ) : null}
            {toMoney(item.directCostEstimated) > 0 ? (
              <p className="mt-2 text-xs text-slate-500">آخر تكلفة مباشرة محفوظة: {formatEgp(item.directCostEstimated)}</p>
            ) : null}
          </div>
        </div>
      </div>
      {save.error ? (
        <p className="px-5 pb-2 text-sm text-red-700">
          {save.error instanceof Error ? save.error.message : 'تعذر حفظ تحليل السعر'}
        </p>
      ) : null}
      <FormStickyFooter
        onCancel={onClose}
        onSave={() => save.mutate()}
        saveText="حفظ وإعادة احتساب السعر"
        cancelText="إلغاء"
        saveLoading={save.isPending}
        saveDisabled={lines.length === 0 || isOwnerBoqHeader(item)}
        className="mt-0"
      />
    </CenteredOverlay>
  );
}
