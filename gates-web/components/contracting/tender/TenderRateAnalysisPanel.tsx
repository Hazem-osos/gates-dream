'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import {
  boqHeaderRoleLabel,
  canEnterBoqLineQuantity,
  isParentItemCode,
  parentCodeFromItemCode,
  type HierarchicalWorkRow,
} from '@/lib/contracting/boq-hierarchy';
import { BoqHierarchyTreeCell } from '@/components/contracting/BoqHierarchyTreeCell';
import { formatEgp, formatQty } from '@/lib/subcontracts/money';
import { cn } from '@/lib/utils';
import {
  dataEntryGridBodyCellClass,
  dataEntryGridHeadCellClass,
  dataEntryGridHeadRowClass,
  dataEntryGridInputClass,
  dataEntryGridNumericInputClass,
  dataEntryGridWrapClass,
} from '@/components/ui/data-entry-grid/tokens';
import { erpInputClass, erpLabelClass } from '@/components/erp';
import { dateControlClass } from '@/app/components/ui/forms/formTokens';
import {
  analysisElementCost,
  COST_ELEMENT_AR,
  isTenderHeaderKind,
  QUOTATION_STATUS_AR,
} from './tender-labels';

export type TenderBoqForAnalysis = {
  id: string;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  quantity: string;
  kind: string | null;
  isExecutable?: boolean;
  directUnitCost: string;
  sellingUnitRate: string;
  rateAnalysisItems: Array<{
    id: string;
    costElementType: string;
    resourceCode?: string | null;
    descriptionAr: string;
    unit: string;
    consumptionQuotaPerUnit: string;
    wasteFactorRate?: string;
    unitCost: string;
    totalCostPerUnit: string;
  }>;
};

type QuotationMeta = {
  id: string;
  quotationNumber: string;
  revisionNumber: number;
  status: string;
  quoteDate: string | null;
};

type GridRow =
  | { kind: 'boq'; boq: HierarchicalWorkRow<TenderBoqForAnalysis> }
  | {
      kind: 'rate';
      boq: HierarchicalWorkRow<TenderBoqForAnalysis>;
      rate: TenderBoqForAnalysis['rateAnalysisItems'][number];
    }
  | { kind: 'add-rate'; boq: HierarchicalWorkRow<TenderBoqForAnalysis> };

function isBoqHeaderRow(b: HierarchicalWorkRow<TenderBoqForAnalysis>): boolean {
  return b.__isParent || b.isExecutable === false || isTenderHeaderKind(b.kind);
}

function directUnitFromRates(boq: TenderBoqForAnalysis): number {
  if (!boq.rateAnalysisItems.length) return Number(boq.directUnitCost) || 0;
  return boq.rateAnalysisItems.reduce((sum, r) => {
    const quota = Number(r.consumptionQuotaPerUnit);
    const waste = Number(r.wasteFactorRate ?? 0);
    const unitCost = Number(r.unitCost);
    const line = Number(r.totalCostPerUnit) || analysisElementCost(quota, waste, unitCost);
    return sum + line;
  }, 0);
}

type RateAnalysisSaveItem = {
  costElementType: string;
  resourceCode?: string;
  descriptionAr: string;
  unit: string;
  consumptionQuotaPerUnit: number;
  unitCost: number;
  wasteFactorRate: number;
};

function ratePayload(items: TenderBoqForAnalysis['rateAnalysisItems']): RateAnalysisSaveItem[] {
  return items.map((x) => ({
    costElementType: x.costElementType,
    resourceCode: x.resourceCode ?? undefined,
    descriptionAr: x.descriptionAr,
    unit: x.unit,
    consumptionQuotaPerUnit: Number(x.consumptionQuotaPerUnit),
    unitCost: Number(x.unitCost),
    wasteFactorRate: Number(x.wasteFactorRate ?? 0),
  }));
}

type Rollup = { tenderQty: number; tenderUnitRate: number; directTotal: number; lineGrandTotal: number };

function isHeaderBoqItem(boq: TenderBoqForAnalysis, all: TenderBoqForAnalysis[]): boolean {
  const codes = all.map((row) => row.itemCode);
  return (
    boq.isExecutable === false ||
    isTenderHeaderKind(boq.kind) ||
    isParentItemCode(boq.itemCode, codes)
  );
}

function rollupBoqItem(boq: TenderBoqForAnalysis, all: TenderBoqForAnalysis[]): Rollup {
  if (!isHeaderBoqItem(boq, all)) {
    const tenderQty = Number(boq.quantity) || 0;
    const tenderUnitRate = directUnitFromRates(boq);
    const directTotal = tenderQty * tenderUnitRate;
    const selling = Number(boq.sellingUnitRate) || tenderUnitRate;
    return {
      tenderQty,
      tenderUnitRate,
      directTotal,
      lineGrandTotal: tenderQty * selling,
    };
  }
  const parentCode = boq.itemCode;
  const children = all.filter((row) => parentCodeFromItemCode(row.itemCode) === parentCode);
  if (!children.length) {
    return { tenderQty: 0, tenderUnitRate: 0, directTotal: 0, lineGrandTotal: 0 };
  }
  return children.reduce(
    (acc, kid) => {
      const r = rollupBoqItem(kid, all);
      return {
        tenderQty: acc.tenderQty + r.tenderQty,
        tenderUnitRate: 0,
        directTotal: acc.directTotal + r.directTotal,
        lineGrandTotal: acc.lineGrandTotal + r.lineGrandTotal,
      };
    },
    { tenderQty: 0, tenderUnitRate: 0, directTotal: 0, lineGrandTotal: 0 }
  );
}

export function TenderRateAnalysisPanel({
  tenderNumber,
  issueDate,
  quotations,
  boqItems,
  visibleBoqRows,
  expandedBoqCodes,
  toggleBoqExpand,
  boqChildCodes,
  locked,
  onRefresh,
}: {
  tenderNumber: string;
  issueDate: string | null;
  quotations: QuotationMeta[];
  boqItems: TenderBoqForAnalysis[];
  visibleBoqRows: HierarchicalWorkRow<TenderBoqForAnalysis>[];
  expandedBoqCodes: ReadonlySet<string>;
  toggleBoqExpand: (code: string) => void;
  boqChildCodes: (code: string) => boolean;
  locked: boolean;
  onRefresh: () => void;
}) {
  const pricingQtn = useMemo(() => {
    const accepted = quotations.find((q) => q.status === 'ACCEPTED');
    if (accepted) return accepted;
    return quotations.length ? quotations[quotations.length - 1] : null;
  }, [quotations]);

  const [pricingDate, setPricingDate] = useState('');
  const [pricingApproved, setPricingApproved] = useState<'yes' | 'no'>('no');
  const [expandedRateBoqIds, setExpandedRateBoqIds] = useState<Set<string>>(() => new Set());
  const [addRateDraft, setAddRateDraft] = useState<Record<string, { costElementType: string; descriptionAr: string }>>({});

  useEffect(() => {
    setPricingDate(pricingQtn?.quoteDate?.slice(0, 10) ?? issueDate?.slice(0, 10) ?? '');
    setPricingApproved(pricingQtn?.status === 'ACCEPTED' ? 'yes' : 'no');
  }, [pricingQtn?.id, pricingQtn?.quoteDate, pricingQtn?.status, issueDate]);

  const rollupById = useMemo(() => {
    const map = new Map<string, Rollup>();
    for (const row of boqItems) map.set(row.id, rollupBoqItem(row, boqItems));
    return map;
  }, [boqItems]);

  const saveRate = useMutation({
    mutationFn: async (input: { boqId: string; items: RateAnalysisSaveItem[] }) =>
      apiClient.post(`/contracting/tenders/boq/${input.boqId}/rate-analysis`, { items: input.items }),
    onSuccess: () => onRefresh(),
  });

  const patchQtn = useMutation({
    mutationFn: async (input: { quotationId: string; quoteDate: string }) =>
      apiClient.patch(`/contracting/tenders/quotations/${input.quotationId}`, {
        quoteDate: input.quoteDate,
      }),
    onSuccess: () => onRefresh(),
  });

  const qtnStatusAction = useMutation({
    mutationFn: async (input: { quotationId: string; action: 'accept' | 'reject' }) =>
      apiClient.post(`/contracting/tenders/quotations/${input.quotationId}/${input.action}`, {}),
    onSuccess: () => onRefresh(),
  });

  const gridRows = useMemo((): GridRow[] => {
    const out: GridRow[] = [];
    for (const boq of visibleBoqRows) {
      out.push({ kind: 'boq', boq });
      const header = isBoqHeaderRow(boq);
      if (!header && expandedRateBoqIds.has(boq.id)) {
        for (const rate of boq.rateAnalysisItems) out.push({ kind: 'rate', boq, rate });
        if (!locked) out.push({ kind: 'add-rate', boq });
      }
    }
    return out;
  }, [visibleBoqRows, expandedRateBoqIds, locked]);

  const pricingNumberLabel = pricingQtn
    ? `${pricingQtn.quotationNumber} (Rev ${pricingQtn.revisionNumber})`
    : tenderNumber;

  const persistDate = () => {
    if (!pricingQtn || locked || !pricingDate) return;
    patchQtn.mutate({ quotationId: pricingQtn.id, quoteDate: pricingDate });
  };

  const onApprovedChange = (value: 'yes' | 'no') => {
    if (!pricingQtn || locked) return;
    if (value === 'yes' && pricingQtn.status !== 'ACCEPTED') {
      qtnStatusAction.mutate({ quotationId: pricingQtn.id, action: 'accept' });
    } else if (value === 'no' && pricingQtn.status === 'ACCEPTED') {
      qtnStatusAction.mutate({ quotationId: pricingQtn.id, action: 'reject' });
    }
    setPricingApproved(value);
  };

  const patchRateLine = (
    boq: HierarchicalWorkRow<TenderBoqForAnalysis>,
    rateId: string,
    patch: Partial<TenderBoqForAnalysis['rateAnalysisItems'][number]>
  ) => {
    const items = ratePayload(
      boq.rateAnalysisItems.map((x) => (x.id === rateId ? { ...x, ...patch } : x))
    );
    saveRate.mutate({ boqId: boq.id, items });
  };

  const addRateLine = (boq: HierarchicalWorkRow<TenderBoqForAnalysis>) => {
    const draft = addRateDraft[boq.id] ?? { costElementType: 'MATERIAL', descriptionAr: 'مواد' };
    saveRate.mutate({
      boqId: boq.id,
      items: [
        ...ratePayload(boq.rateAnalysisItems),
        {
          costElementType: draft.costElementType,
          descriptionAr: draft.descriptionAr,
          unit: boq.unit,
          consumptionQuotaPerUnit: 1,
          unitCost: 0,
          wasteFactorRate: 0,
        },
      ],
    });
  };

  const removeRateLine = (boq: HierarchicalWorkRow<TenderBoqForAnalysis>, rateId: string) => {
    saveRate.mutate({
      boqId: boq.id,
      items: ratePayload(boq.rateAnalysisItems.filter((x) => x.id !== rateId)),
    });
  };

  const toggleRateExpand = (boqId: string) => {
    setExpandedRateBoqIds((prev) => {
      const next = new Set(prev);
      if (next.has(boqId)) next.delete(boqId);
      else next.add(boqId);
      return next;
    });
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3">
        <label className={erpLabelClass}>
          رقم التسعير
          <input className={cn(erpInputClass, 'mt-1 font-mono')} value={pricingNumberLabel} readOnly />
        </label>
        <label className={erpLabelClass}>
          تاريخ التسعير
          <input
            type="date"
            className={cn(dateControlClass, 'mt-1 w-full')}
            value={pricingDate}
            disabled={locked || !pricingQtn}
            onChange={(e) => setPricingDate(e.target.value)}
            onBlur={persistDate}
          />
        </label>
        <label className={erpLabelClass}>
          حالة التسعير
          <select
            className={cn(erpInputClass, 'mt-1')}
            value={pricingApproved}
            disabled={locked || !pricingQtn}
            onChange={(e) => onApprovedChange(e.target.value as 'yes' | 'no')}
          >
            <option value="no">غير معتمد</option>
            <option value="yes">معتمد</option>
          </select>
          {pricingQtn ? (
            <span className="mt-1 block text-[10px] text-slate-500">
              {QUOTATION_STATUS_AR[pricingQtn.status] ?? pricingQtn.status}
            </span>
          ) : (
            <span className="mt-1 block text-[10px] text-amber-700">أنشئ عرض سعر من تبويب عروض الأسعار لربط التسعير.</span>
          )}
        </label>
      </div>

      <div className={dataEntryGridWrapClass}>
        <table className="min-w-full text-sm">
          <thead className={dataEntryGridHeadRowClass}>
            <tr>
              <th className={dataEntryGridHeadCellClass}>كود البند</th>
              <th className={dataEntryGridHeadCellClass}>الوحدة</th>
              <th className={dataEntryGridHeadCellClass}>اسم البند</th>
              <th className={dataEntryGridHeadCellClass}>كمية البند التحليلي</th>
              <th className={dataEntryGridHeadCellClass}>فئة البند التحليلي</th>
              <th className={dataEntryGridHeadCellClass}>إجمالي تكلفة الوحدة</th>
              <th className={dataEntryGridHeadCellClass}>إجمالي كمية البند</th>
              <th className={dataEntryGridHeadCellClass}>إجمالي التكلفة</th>
              <th className={dataEntryGridHeadCellClass}>كمية بند العطاء</th>
              <th className={dataEntryGridHeadCellClass}>فئة بند العطاء</th>
              <th className={dataEntryGridHeadCellClass}>إجمالي البند</th>
              {!locked ? <th className={dataEntryGridHeadCellClass} /> : null}
            </tr>
          </thead>
          <tbody>
            {gridRows.map((row) => {
              if (row.kind === 'boq') {
                const b = row.boq;
                const header = isBoqHeaderRow(b);
                const rollup = rollupById.get(b.id);
                const tenderQty = header ? rollup?.tenderQty : Number(b.quantity);
                const execUnitRate = directUnitFromRates(b);
                const directTotal = header
                  ? (rollup?.directTotal ?? 0)
                  : tenderQty * execUnitRate;
                const tenderUnitRate = header
                  ? rollup && rollup.tenderQty > 0
                    ? rollup.directTotal / rollup.tenderQty
                    : 0
                  : execUnitRate;
                const lineGrand = header
                  ? (rollup?.lineGrandTotal ?? 0)
                  : tenderQty * (Number(b.sellingUnitRate) || execUnitRate);
                const headerLabel = boqHeaderRoleLabel(header, b.__depth);
                const hasBoqKids = b.__isParent || boqChildCodes(b.itemCode);
                const hasRateKids = !header && b.rateAnalysisItems.length > 0;
                const showRateChevron = !header;

                return (
                  <tr key={`boq-${b.id}`} className={header ? 'bg-[#EEF6FA]' : undefined}>
                    <td className={dataEntryGridBodyCellClass}>
                      <div className="flex items-center gap-0.5">
                        {showRateChevron ? (
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 text-[#0E78AA] hover:bg-white"
                            aria-label="تفاصيل التحليل"
                            onClick={() => toggleRateExpand(b.id)}
                          >
                            {expandedRateBoqIds.has(b.id) ? '▼' : '◀'}
                          </button>
                        ) : null}
                        <BoqHierarchyTreeCell
                          code={b.itemCode}
                          depth={b.__depth}
                          isParent={header}
                          hasChildren={hasBoqKids}
                          expanded={expandedBoqCodes.has(b.itemCode)}
                          onToggleExpand={() => toggleBoqExpand(b.itemCode)}
                          className="flex-1"
                        />
                        {headerLabel && !showRateChevron ? null : null}
                      </div>
                    </td>
                    <td className={dataEntryGridBodyCellClass}>{header ? '—' : b.unit}</td>
                    <td className={dataEntryGridBodyCellClass}>{b.descriptionAr}</td>
                    <td className={dataEntryGridBodyCellClass}>—</td>
                    <td className={dataEntryGridBodyCellClass}>—</td>
                    <td className={dataEntryGridBodyCellClass}>
                      {header ? '—' : formatEgp(tenderUnitRate)}
                    </td>
                    <td className={dataEntryGridBodyCellClass}>—</td>
                    <td className={dataEntryGridBodyCellClass}>
                      {header ? formatEgp(directTotal) : formatEgp(directTotal)}
                    </td>
                    <td className={dataEntryGridBodyCellClass}>
                      {canEnterBoqLineQuantity(header) ? formatQty(tenderQty) : formatQty(tenderQty) || '—'}
                    </td>
                    <td className={cn(dataEntryGridBodyCellClass, 'font-semibold')}>
                      {tenderUnitRate > 0 ? formatEgp(tenderUnitRate) : '—'}
                    </td>
                    <td className={cn(dataEntryGridBodyCellClass, 'font-bold')}>{formatEgp(lineGrand)}</td>
                    {!locked ? (
                      <td className={dataEntryGridBodyCellClass}>
                        {!header && hasRateKids ? (
                          <button type="button" className="text-xs text-[#0E78AA]" onClick={() => toggleRateExpand(b.id)}>
                            {expandedRateBoqIds.has(b.id) ? 'إخفاء التحليل' : 'تحليل'}
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              }

              if (row.kind === 'add-rate') {
                const b = row.boq;
                const draft = addRateDraft[b.id] ?? { costElementType: 'MATERIAL', descriptionAr: 'مواد' };
                return (
                  <tr key={`add-${b.id}`} className="bg-[#F6FBFD]">
                    <td className={dataEntryGridBodyCellClass} colSpan={3}>
                      <span className="text-xs text-slate-500">سطر تحليل جديد تحت {b.itemCode}</span>
                    </td>
                    <td className={dataEntryGridBodyCellClass} colSpan={7}>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className={dataEntryGridInputClass}
                          value={draft.costElementType}
                          onChange={(e) =>
                            setAddRateDraft((p) => ({
                              ...p,
                              [b.id]: {
                                ...draft,
                                costElementType: e.target.value,
                                descriptionAr: COST_ELEMENT_AR[e.target.value] ?? e.target.value,
                              },
                            }))
                          }
                        >
                          {Object.entries(COST_ELEMENT_AR).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <input
                          className={dataEntryGridInputClass}
                          placeholder="البيان"
                          value={draft.descriptionAr}
                          onChange={(e) =>
                            setAddRateDraft((p) => ({ ...p, [b.id]: { ...draft, descriptionAr: e.target.value } }))
                          }
                        />
                        <Button type="button" size="sm" disabled={saveRate.isPending} onClick={() => addRateLine(b)}>
                          <Plus className="h-3.5 w-3.5" />
                          إضافة
                        </Button>
                      </div>
                    </td>
                    <td className={dataEntryGridBodyCellClass} />
                  </tr>
                );
              }

              const { boq: b, rate: r } = row;
              const tenderQty = Number(b.quantity) || 0;
              const quota = Number(r.consumptionQuotaPerUnit);
              const waste = Number(r.wasteFactorRate ?? 0);
              const unitCost = Number(r.unitCost);
              const unitTotal = Number(r.totalCostPerUnit) || analysisElementCost(quota, waste, unitCost);
              const totalAnalysisQty = quota * tenderQty;
              const totalCost = unitTotal * tenderQty;

              return (
                <tr key={`rate-${r.id}`} className="bg-white">
                  <td className={dataEntryGridBodyCellClass} style={{ paddingInlineStart: 24 + b.__depth * 14 }}>
                    <span className="font-mono text-xs text-slate-600">{r.resourceCode || '—'}</span>
                  </td>
                  <td className={dataEntryGridBodyCellClass}>{r.unit}</td>
                  <td className={dataEntryGridBodyCellClass}>
                    <span className="text-xs">{COST_ELEMENT_AR[r.costElementType] ?? r.costElementType} — {r.descriptionAr}</span>
                  </td>
                  <td className={dataEntryGridBodyCellClass}>
                    {locked ? (
                      formatQty(quota)
                    ) : (
                      <input
                        type="number"
                        step="0.0001"
                        className={dataEntryGridNumericInputClass}
                        defaultValue={quota}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n !== quota) {
                            patchRateLine(b, r.id, { consumptionQuotaPerUnit: String(n) });
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className={dataEntryGridBodyCellClass}>
                    {locked ? (
                      formatEgp(unitCost)
                    ) : (
                      <input
                        type="number"
                        className={dataEntryGridNumericInputClass}
                        defaultValue={unitCost}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n !== unitCost) {
                            patchRateLine(b, r.id, { unitCost: String(n) });
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className={dataEntryGridBodyCellClass}>{formatEgp(unitTotal)}</td>
                  <td className={dataEntryGridBodyCellClass}>{formatQty(totalAnalysisQty)}</td>
                  <td className={dataEntryGridBodyCellClass}>{formatEgp(totalCost)}</td>
                  <td className={dataEntryGridBodyCellClass}>—</td>
                  <td className={dataEntryGridBodyCellClass}>—</td>
                  <td className={dataEntryGridBodyCellClass}>—</td>
                  {!locked ? (
                    <td className={dataEntryGridBodyCellClass}>
                      <button type="button" className="text-xs text-red-600" onClick={() => removeRateLine(b, r.id)}>
                        حذف
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {!boqItems.length ? (
              <tr>
                <td className={dataEntryGridBodyCellClass} colSpan={locked ? 11 : 12}>
                  أضف بنود جدول الكميات أولاً.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        البنود الرئيسية والرئيسية الفرعية تُجمَّع تلقائياً. أدخل كمية وفئة التحليل على السطور التفصيلية تحت البند التنفيذي.
        كمية بند العطاء من جدول الكميات؛ فئة بند العطاء = مجموع تكاليف التحليل للوحدة.
      </p>
    </section>
  );
}
