'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { formatEgp, formatQty } from '@/lib/subcontracts/money';
import { percentInputToRate, rateToPercentInput } from '@/lib/contracting/selling-study';
import {
  dataEntryGridBodyCellClass,
  dataEntryGridHeadCellClass,
  dataEntryGridHeadRowClass,
  dataEntryGridNumericInputClass,
  dataEntryGridWrapClass,
} from '@/components/ui/data-entry-grid/tokens';
import { erpInputClass, erpLabelClass } from '@/components/erp';
import { toast } from '@/lib/feedback/toast';

type ScenarioMeta = {
  id: string;
  scenarioName: string;
  isApproved: boolean;
  sortOrder: number;
};

type StudyRow = {
  rateAnalysisItemId: string;
  tenderBoqItemId: string;
  itemCode: string;
  boqDescriptionAr: string;
  resourceCode: string | null;
  descriptionAr: string;
  unit: string;
  supplyQty: number;
  bandFactor: number;
  operationalMarginRate: number;
  administrativeMarginRate: number;
  totalMarginRate: number;
  profitValue: number;
  totalProfit: number;
  sellingUnitPrice: number;
};

type SheetResponse = {
  scenario: { id: string; scenarioName: string; isApproved: boolean };
  rows: StudyRow[];
  boqSellingUnitPreview: Record<string, number>;
};

export function TenderSalesStudyPanel({
  tenderId,
  locked,
}: {
  tenderId: string;
  locked: boolean;
}) {
  const listKey = ['tender-selling-scenarios', tenderId];
  const invalidate = useInvalidateQuery();
  const { data: listRes, refetch: refetchList } = useApiQuery<{ scenarios: ScenarioMeta[] }>(
    listKey,
    `/contracting/tenders/${tenderId}/selling-scenarios`
  );
  const scenarios = listRes?.data?.scenarios ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId && scenarios.some((s) => s.id === activeId)) return;
    const approved = scenarios.find((s) => s.isApproved);
    setActiveId(approved?.id ?? scenarios[0]?.id ?? null);
  }, [scenarios, activeId]);

  const sheetKey = ['tender-selling-sheet', tenderId, activeId ?? 'none'];
  const { data: sheetRes, refetch: refetchSheet, isLoading } = useApiQuery<SheetResponse>(
    sheetKey,
    `/contracting/tenders/${tenderId}/selling-scenarios/${activeId}/sheet`,
    undefined,
    { enabled: Boolean(activeId) }
  );
  const sheet = sheetRes?.data;

  const [marginDraft, setMarginDraft] = useState<
    Record<string, { op: string; admin: string }>
  >({});

  useEffect(() => {
    if (!sheet?.rows) return;
    const next: Record<string, { op: string; admin: string }> = {};
    for (const row of sheet.rows) {
      next[row.rateAnalysisItemId] = {
        op: rateToPercentInput(row.operationalMarginRate),
        admin: rateToPercentInput(row.administrativeMarginRate),
      };
    }
    setMarginDraft(next);
  }, [sheet?.scenario.id, sheet?.rows]);

  const createScenario = useMutation({
    mutationFn: () => apiClient.post(`/contracting/tenders/${tenderId}/selling-scenarios`, {}),
    onSuccess: (res) => {
      const id = (res as { data?: { id?: string } }).data?.id;
      invalidate(listKey);
      void refetchList();
      if (id) setActiveId(id);
      toast.success('تم إنشاء تسعير جديد');
    },
  });

  const saveMargins = useMutation({
    mutationFn: async () => {
      if (!activeId || !sheet) return;
      const patches = sheet.rows.map((row) => {
        const d = marginDraft[row.rateAnalysisItemId] ?? { op: '', admin: '' };
        return {
          rateAnalysisItemId: row.rateAnalysisItemId,
          operationalMarginRate: percentInputToRate(d.op),
          administrativeMarginRate: percentInputToRate(d.admin),
        };
      });
      await apiClient.patch(`/contracting/tenders/${tenderId}/selling-scenarios/${activeId}/margins`, {
        patches,
      });
    },
    onSuccess: () => {
      invalidate(sheetKey);
      void refetchSheet();
      toast.success('تم حفظ هوامش الربح');
    },
  });

  const setApproved = useMutation({
    mutationFn: async (approved: boolean) => {
      if (!activeId) return;
      await apiClient.post(`/contracting/tenders/${tenderId}/selling-scenarios/${activeId}/approve`, {
        approved,
      });
    },
    onSuccess: () => {
      invalidate(listKey);
      invalidate(sheetKey);
      void refetchList();
      void refetchSheet();
      toast.success('تم تحديث الموافقة على التسعير');
    },
  });

  const applyToBoq = useMutation({
    mutationFn: async () => {
      if (!activeId) return;
      await apiClient.post(`/contracting/tenders/${tenderId}/selling-scenarios/${activeId}/apply-boq`, {});
    },
    onSuccess: () => {
      invalidate(['tender', tenderId]);
      invalidate(['tender-pricing', tenderId]);
      toast.success('تم تطبيق أسعار البيع على جدول الكميات');
    },
  });

  const totals = useMemo(() => {
    if (!sheet?.rows.length) return { profit: 0, selling: 0 };
    return {
      profit: sheet.rows.reduce((s, r) => s + r.totalProfit, 0),
      selling: sheet.rows.reduce((s, r) => s + r.sellingUnitPrice * r.supplyQty, 0),
    };
  }, [sheet?.rows]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className={erpLabelClass}>
          سيناريو التسعير
          <select
            className={erpInputClass + ' mt-1 min-w-[12rem]'}
            value={activeId ?? ''}
            onChange={(e) => setActiveId(e.target.value || null)}
          >
            {!scenarios.length ? <option value="">—</option> : null}
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.scenarioName}{s.isApproved ? ' ✓ معتمد' : ''}
              </option>
            ))}
          </select>
        </label>
        {!locked && (
          <Button type="button" variant="secondary" size="sm" disabled={createScenario.isPending} onClick={() => createScenario.mutate()}>
            + تسعير جديد
          </Button>
        )}
        {activeId && sheet && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sheet.scenario.isApproved}
              disabled={locked || setApproved.isPending}
              onChange={(e) => setApproved.mutate(e.target.checked)}
            />
            تمت الموافقة على هذا التسعير
          </label>
        )}
        {activeId && !locked && (
          <>
            <Button type="button" size="sm" disabled={saveMargins.isPending} onClick={() => saveMargins.mutate()}>
              حفظ الهوامش
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={applyToBoq.isPending || !sheet?.scenario.isApproved}
              onClick={() => applyToBoq.mutate()}
            >
              تطبيق على جدول الكميات
            </Button>
          </>
        )}
      </div>

      {!scenarios.length ? (
        <p className="text-sm text-slate-600">أنشئ تسعيراً جديداً، ثم أدخل هوامش الربح على بنود الإمداد في التحليل.</p>
      ) : isLoading || !sheet ? (
        <p className="text-sm text-slate-600">جاري تحميل شيت دراسة البيع…</p>
      ) : !sheet.rows.length ? (
        <p className="text-sm text-slate-600">أضف بنود تحليل أسعار (بنود الإمداد) تحت البنود التنفيذية في تبويب تحليل الأسعار أولاً.</p>
      ) : (
        <>
          <div className={dataEntryGridWrapClass}>
            <table className="min-w-full text-sm">
              <thead className={dataEntryGridHeadRowClass}>
                <tr>
                  <th className={dataEntryGridHeadCellClass}>الكود</th>
                  <th className={dataEntryGridHeadCellClass}>الوحدة</th>
                  <th className={dataEntryGridHeadCellClass}>بند العطاء</th>
                  <th className={dataEntryGridHeadCellClass}>كمية بند الإمداد</th>
                  <th className={dataEntryGridHeadCellClass}>فئة البند</th>
                  <th className={dataEntryGridHeadCellClass}>هامش الربح التشغيلي %</th>
                  <th className={dataEntryGridHeadCellClass}>هامش الربح الإداري %</th>
                  <th className={dataEntryGridHeadCellClass}>إجمالي نسبة الربح</th>
                  <th className={dataEntryGridHeadCellClass}>قيمة الربح</th>
                  <th className={dataEntryGridHeadCellClass}>إجمالي الربح</th>
                  <th className={dataEntryGridHeadCellClass}>سعر البيع</th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row) => {
                  const draft = marginDraft[row.rateAnalysisItemId] ?? { op: '', admin: '' };
                  const opRate = percentInputToRate(draft.op);
                  const adminRate = percentInputToRate(draft.admin);
                  const totalPct = (opRate + adminRate) * 100;
                  const profitValue = row.bandFactor * (opRate + adminRate);
                  const totalProfit = profitValue * row.supplyQty;
                  const selling = row.bandFactor + profitValue;
                  const code = row.resourceCode || row.itemCode;
                  return (
                    <tr key={row.rateAnalysisItemId}>
                      <td className={cnCell + ' font-mono text-xs'}>{code}</td>
                      <td className={cnCell}>{row.unit}</td>
                      <td className={cnCell}>
                        <span className="block text-xs text-slate-500">{row.itemCode}</span>
                        {row.descriptionAr}
                      </td>
                      <td className={cnCell}>{formatQty(row.supplyQty)}</td>
                      <td className={cnCell}>{formatEgp(row.bandFactor)}</td>
                      <td className={cnCell}>
                        {locked ? (
                          rateToPercentInput(row.operationalMarginRate) || '—'
                        ) : (
                          <input
                            className={dataEntryGridNumericInputClass}
                            inputMode="decimal"
                            placeholder="0"
                            value={draft.op}
                            onChange={(e) =>
                              setMarginDraft((p) => ({
                                ...p,
                                [row.rateAnalysisItemId]: { ...draft, op: e.target.value },
                              }))
                            }
                          />
                        )}
                      </td>
                      <td className={cnCell}>
                        {locked ? (
                          rateToPercentInput(row.administrativeMarginRate) || '—'
                        ) : (
                          <input
                            className={dataEntryGridNumericInputClass}
                            inputMode="decimal"
                            placeholder="0"
                            value={draft.admin}
                            onChange={(e) =>
                              setMarginDraft((p) => ({
                                ...p,
                                [row.rateAnalysisItemId]: { ...draft, admin: e.target.value },
                              }))
                            }
                          />
                        )}
                      </td>
                      <td className={cnCell}>{totalPct.toFixed(2)}%</td>
                      <td className={cnCell}>{formatEgp(profitValue)}</td>
                      <td className={cnCell}>{formatEgp(totalProfit)}</td>
                      <td className={cnCell + ' font-semibold'}>{formatEgp(selling)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            قيمة الربح = فئة البند × إجمالي نسبة الربح — إجمالي الربح = قيمة الربح × كمية الإمداد — سعر البيع = فئة البند + قيمة الربح.
            ملخص التسعير: إجمالي ربح الإمداد {formatEgp(totals.profit)} — مساهمة البيع {formatEgp(totals.selling)}.
          </p>
        </>
      )}
    </section>
  );
}

const cnCell = dataEntryGridBodyCellClass;
