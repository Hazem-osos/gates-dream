'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Map as MapIcon } from 'lucide-react';
import { AppTable, CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import {
  ownerBoqHierarchyHints,
  withItemCodeHierarchy,
} from '@/lib/contracting/boq-hierarchy';
import {
  executionPlanAnalysisLine,
  executionPlanDistribution,
  executionPlanTenderTotals,
} from '@/lib/contracting/execution-plan-view';
import { BOQ_UNIT_LABEL } from '@/lib/contracting/labels';
import type { OwnerBoqItem, RateAnalysisItem } from '@/lib/contracting/types';
import { formatEgp, formatPercent, formatQty, toMoney } from '@/lib/subcontracts/money';

type Plan = {
  id: string;
  planName: string;
  versionNumber: number;
  status: string;
};

type AllocationSummary = {
  items: Array<{
    projectBOQItemId: string;
    itemCode: string;
    effectiveQuantity: number;
    allocatedQuantity: number;
    remainingToAllocate: number;
    plannedUnitCost: number | null;
    plannedCost: number | null;
  }>;
};

type AnalysisRow = RateAnalysisItem & ReturnType<typeof executionPlanAnalysisLine>;

function isHeader(item: OwnerBoqItem, dottedParent: boolean): boolean {
  if (item.hasChildren === true || item.isLeaf === false || item.isExecutable === false) return true;
  if (item.hasChildren === false || item.isLeaf === true) return false;
  return dottedParent;
}

export function ExtractsExecutionPlanBoard({ projectId }: { projectId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeQ = useApiQuery<Plan | null>(
    queryKeys.contracting.executionPlan(projectId),
    `/contracting/execution/projects/${projectId}/plans/active`,
    undefined,
    { enabled: Boolean(projectId), staleTime: staleTimes.transactionalMs }
  );
  const draftQ = useApiQuery<Plan | null>(
    ['contracting', 'execution-draft', projectId],
    `/contracting/execution/projects/${projectId}/plans/draft`,
    undefined,
    { enabled: Boolean(projectId), staleTime: staleTimes.transactionalMs }
  );
  const boqQ = useApiQuery<OwnerBoqItem[]>(
    queryKeys.contracting.ownerBoq(projectId),
    `/contracting/technical-office/projects/${projectId}/boq`,
    undefined,
    { enabled: Boolean(projectId), staleTime: staleTimes.transactionalMs }
  );

  const displayPlan = draftQ.data?.data ?? activeQ.data?.data ?? null;
  const allocQ = useApiQuery<AllocationSummary>(
    ['contracting', 'execution-alloc', projectId, displayPlan?.id ?? ''],
    displayPlan
      ? `/contracting/execution/plans/${displayPlan.id}/allocation-summary?projectId=${projectId}`
      : '',
    undefined,
    { enabled: Boolean(displayPlan?.id), staleTime: staleTimes.transactionalMs }
  );

  const allocByBoq = useMemo(() => {
    const map = new Map<string, AllocationSummary['items'][0]>();
    for (const row of allocQ.data?.data?.items ?? []) map.set(row.projectBOQItemId, row);
    return map;
  }, [allocQ.data?.data?.items]);

  const rows = useMemo(
    () => withItemCodeHierarchy(boqQ.data?.data ?? [], (item) => item.itemCode, ownerBoqHierarchyHints),
    [boqQ.data?.data]
  );

  const selected = rows.find((item) => item.id === selectedId) ?? null;
  const selectedIsHeader = selected ? isHeader(selected, selected.__isParent) : false;
  const selectedAlloc = selected ? allocByBoq.get(selected.id) : undefined;
  const analysisRows: AnalysisRow[] = useMemo(() => {
    if (!selected || selectedIsHeader) return [];
    const contractQuantity = toMoney(selected.contractQuantity);
    const allocatedQuantity = toMoney(selectedAlloc?.allocatedQuantity);
    return (selected.rateAnalysisItems ?? []).map((line) => ({
      ...line,
      ...executionPlanAnalysisLine({
        consumptionQuotaPerUnit: toMoney(line.consumptionQuotaPerUnit),
        unitCost: toMoney(line.unitCost),
        totalCostPerUnit: toMoney(line.totalCostPerUnit),
        contractQuantity,
        allocatedQuantity,
      }),
    }));
  }, [selected, selectedIsHeader, selectedAlloc]);

  const tenderTotal = rows.reduce((sum, item) => {
    if (isHeader(item, item.__isParent)) return sum;
    return sum + executionPlanTenderTotals({
      contractQuantity: toMoney(item.contractQuantity),
      unitSellingPrice: toMoney(item.unitSellingPrice),
    }).tenderTotal;
  }, 0);
  const distributionTotal = rows.reduce((sum, item) => {
    if (isHeader(item, item.__isParent)) return sum;
    const alloc = allocByBoq.get(item.id);
    return (
      sum +
      executionPlanDistribution({
        allocatedQuantity: toMoney(alloc?.allocatedQuantity),
        plannedUnitCost: alloc?.plannedUnitCost ?? toMoney(item.directCostEstimated),
        contractQuantity: toMoney(item.contractQuantity),
      }).distributionCost
    );
  }, 0);

  if (!projectId) {
    return (
      <FormSectionCard title="مخطط التنفيذ" subtitle="اختر مشروعاً تنفيذياً لعرض بنود العطاء والتوزيع">
        <p className="sm:col-span-2 text-sm text-slate-600">لا يوجد مشروع محدد.</p>
      </FormSectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <FormSectionCard
        title="بنود مخطط التنفيذ"
        subtitle="كمية وفئة العطاء من المقايسة المعتمدة، والتوزيع من مخطط التنفيذ. التعديل من شاشة المخطط."
        icon={MapIcon}
      >
        <CompactFormField
          label="المخطط"
          readOnly
          value={
            displayPlan
              ? `${displayPlan.planName} — v${displayPlan.versionNumber} (${displayPlan.status})`
              : 'لا يوجد مخطط نشط أو مسودة'
          }
        />
        <CompactFormField label="إجمالي بند العطاء" readOnly value={formatEgp(tenderTotal)} />
        <CompactFormField label="تكلفة التوزيع تحليل" readOnly value={formatEgp(distributionTotal)} />
        <p className="sm:col-span-2 text-sm">
          <Link href={`/contracting/projects/${projectId}/execution-plan`} className="font-semibold text-[#0E78AA] underline">
            فتح مخطط التنفيذ للتعديل
          </Link>
        </p>
      </FormSectionCard>

      <AppTable
        columns={[
          {
            id: 'item',
            header: 'البند',
            cell: (row) => (
              <span style={{ paddingInlineStart: row.__depth * 12 }}>
                {row.descriptionAr}
                {isHeader(row, row.__isParent) ? (
                  <span className="mr-1 text-[10px] text-[#0E78AA]"> رئيسي</span>
                ) : null}
              </span>
            ),
          },
          { id: 'code', header: 'الكود', accessor: 'itemCode' },
          {
            id: 'unit',
            header: 'الوحدة',
            cell: (row) => BOQ_UNIT_LABEL[row.unit] ?? row.unit,
          },
          {
            id: 'tenderQty',
            header: 'كمية بند العطاء',
            numeric: true,
            cell: (row) =>
              isHeader(row, row.__isParent) ? '—' : formatQty(row.contractQuantity),
          },
          {
            id: 'tenderRate',
            header: 'فئة بند العطاء',
            numeric: true,
            cell: (row) =>
              isHeader(row, row.__isParent) ? '—' : formatEgp(row.unitSellingPrice),
          },
          {
            id: 'tenderTotal',
            header: 'إجمالي بند العطاء',
            numeric: true,
            cell: (row) => {
              if (isHeader(row, row.__isParent)) return '—';
              return formatEgp(
                executionPlanTenderTotals({
                  contractQuantity: toMoney(row.contractQuantity),
                  unitSellingPrice: toMoney(row.unitSellingPrice),
                }).tenderTotal
              );
            },
          },
          {
            id: 'allocQty',
            header: 'كمية التوزيع',
            numeric: true,
            cell: (row) => {
              if (isHeader(row, row.__isParent)) return '—';
              return formatQty(allocByBoq.get(row.id)?.allocatedQuantity);
            },
          },
          {
            id: 'allocCost',
            header: 'تكلفة التوزيع تحليل',
            numeric: true,
            cell: (row) => {
              if (isHeader(row, row.__isParent)) return '—';
              const alloc = allocByBoq.get(row.id);
              return formatEgp(
                executionPlanDistribution({
                  allocatedQuantity: toMoney(alloc?.allocatedQuantity),
                  plannedUnitCost: alloc?.plannedUnitCost ?? toMoney(row.directCostEstimated),
                  contractQuantity: toMoney(row.contractQuantity),
                }).distributionCost
              );
            },
          },
          { id: 'notes', header: 'ملاحظات', cell: (row) => row.notes || '—' },
        ]}
        data={rows}
        getRowKey={(row) => row.id}
        isLoading={boqQ.isLoading}
        emptyTitle="لا توجد بنود مقايسة"
        emptyDescription="أضف بنود المقايسة التنفيذية ثم وزّعها على مخطط التنفيذ."
        exportFileName="extracts-execution-plan"
        onRowClick={(row) => setSelectedId(row.id)}
        rowClassName={(row) =>
          selectedId === row.id
            ? 'bg-amber-50'
            : isHeader(row, row.__isParent)
              ? 'bg-[#EEF6FA]'
              : undefined
        }
      />

      <FormSectionCard
        title={selected ? `تحليل البند ${selected.itemCode}` : 'تحليل البند'}
        subtitle={
          selected
            ? selected.descriptionAr
            : 'اختر بنداً تنفيذياً من الجدول لعرض كمية التحليل وفئة التحليل وتوزيعها'
        }
      >
        <div className="sm:col-span-2">
          {!selected ? (
            <p className="text-sm text-slate-600">لم يُختر بند بعد.</p>
          ) : selectedIsHeader ? (
            <p className="text-sm text-slate-600">البند الرئيسي يُفصَّل على البنود التنفيذية.</p>
          ) : (
            <AppTable
              columns={[
                { id: 'name', header: 'البند', accessor: 'descriptionAr' },
                { id: 'code', header: 'الكود', cell: (row) => row.resourceCode || '—' },
                { id: 'unit', header: 'الوحدة', accessor: 'unit' },
                {
                  id: 'qty',
                  header: 'الكمية تحليل',
                  numeric: true,
                  cell: (row) => formatQty(row.analysisQuantity),
                },
                {
                  id: 'rate',
                  header: 'الفئة تحليل',
                  numeric: true,
                  cell: (row) => formatEgp(row.analysisRate),
                },
                {
                  id: 'unitCost',
                  header: 'إجمالي التكلفة للوحدة',
                  numeric: true,
                  cell: (row) => formatEgp(row.costPerUnit),
                },
                {
                  id: 'totalQty',
                  header: 'إجمالي الكمية تحليل',
                  numeric: true,
                  cell: (row) => formatQty(row.analysisTotalQuantity),
                },
                {
                  id: 'totalCost',
                  header: 'إجمالي التكلفة تحليل',
                  numeric: true,
                  cell: (row) => formatEgp(row.analysisTotalCost),
                },
                {
                  id: 'distQty',
                  header: 'كمية التوزيع تحليل',
                  numeric: true,
                  cell: (row) => formatQty(row.distributionQuantity),
                },
                {
                  id: 'distCost',
                  header: 'تكلفة التوزيع تحليل',
                  numeric: true,
                  cell: (row) => formatEgp(row.distributionCost),
                },
                {
                  id: 'overrun',
                  header: 'نسبة التجاوز',
                  numeric: true,
                  cell: (row) => (row.overrunPercent > 0 ? formatPercent(row.overrunPercent, 2) : '—'),
                },
              ]}
              data={analysisRows}
              getRowKey={(row) => row.id || `${row.costElementType}-${row.descriptionAr}`}
              emptyTitle="لا يوجد تفصيل سعر لهذا البند"
              emptyDescription="حلّل السعر من المقايسة التنفيذية ثم ارجع إلى هنا."
              exportFileName="extracts-execution-plan-analysis"
            />
          )}
        </div>
      </FormSectionCard>
    </div>
  );
}
