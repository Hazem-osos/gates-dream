'use client';

import { useMemo, useState } from 'react';
import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import { erpTableHeadCellClass, erpTableHeadRowClass } from '@/components/erp/erpUiTokens';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { CalculationInspector } from '@/components/ai/CalculationInspector';
import type { CostRollupSlice } from '@/app/components/ui/CostRollupCard';
import type { LoadedManufacturingProcess } from '@/lib/manufacturing/process-from-bom';
import { productionOrderStatusLabel, type ProductionOrderStatus } from '@/lib/manufacturing/production-order-status';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';

const MOVEMENT_TYPE_AR: Record<string, string> = {
  PROD_ISSUE: 'صرف خامات تصنيع',
  PROD_ISSUE_REVERSAL: 'عكس صرف خامات',
  PROD_RECEIPT: 'استلام منتج تام',
  PROD_RECEIPT_REVERSAL: 'عكس استلام منتج تام',
};

type MovementRow = {
  id: string;
  movementType: string;
  quantityDelta: number | string;
  unitCost?: number | string | null;
  documentDate?: string;
  item?: { serial?: string | null; arabicName?: string | null };
  warehouse?: { code?: string | null; arabicName?: string | null };
};

export type ProductionOrderBottomSplitOrder = {
  id: string;
  orderNumber: string;
  status: ProductionOrderStatus;
  plannedQuantity: string | number;
  actualQuantity?: string | number | null;
  unitCost?: string | number;
  materialsIssueJournalEntryId: string | null;
  laborOverheadJournalEntryId?: string | null;
  additionalCostsJournalEntryId?: string | null;
  completionJournalEntryId: string | null;
  totalMaterialCost?: string | number;
  totalLaborCost?: string | number;
  totalOverheadCost?: string | number;
};

type Props = {
  order: ProductionOrderBottomSplitOrder | null;
  costSlices: CostRollupSlice[];
  loadedProcess: LoadedManufacturingProcess | null;
  fromWarehouseId: string;
  finishedWarehouseId: string;
  activeTabId?: string;
  onActiveTabChange?: (tabId: string) => void;
};

function num(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(v: number): string {
  if (!v) return '0';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toLocaleString('ar-EG', { maximumFractionDigits: 4 })}`;
}

function ManufacturingOrderStockTab({
  order,
  loadedProcess,
  fromWarehouseId,
  finishedWarehouseId,
}: {
  order: ProductionOrderBottomSplitOrder | null;
  loadedProcess: LoadedManufacturingProcess | null;
  fromWarehouseId: string;
  finishedWarehouseId: string;
}) {
  const materialsPosted = Boolean(order?.materialsIssueJournalEntryId);
  const enabled = Boolean(order?.orderNumber && materialsPosted);

  const { data, isLoading, isFetching } = useApiQuery<MovementRow[]>(
    ['mfg-order-movements', order?.orderNumber],
    '/inventory/movements',
    {
      sourceType: 'MO',
      sourceNumber: order?.orderNumber ?? undefined,
      limit: 100,
    },
    { enabled, skipErrorNotify: true }
  );

  if (!order?.id) {
    return <p className="text-sm text-slate-500 p-2">احفظ أمر التصنيع لعرض الأثر المخزني.</p>;
  }

  if (!materialsPosted) {
    const rawRows =
      loadedProcess?.raws?.filter((r) => r.itemId && (Number(r.quantity) || 0) > 0) ?? [];
    const outputRows =
      loadedProcess?.outputs?.filter((r) => r.itemId && (Number(r.quantity) || 0) > 0) ?? [];
    if (rawRows.length === 0 && outputRows.length === 0) {
      return (
        <p className="text-sm text-slate-500 p-2">
          حمّل نموذج التصنيع لمعاينة صرف الخامات واستلام المنتج المتوقع.
        </p>
      );
    }
    return (
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-2 text-xs font-semibold text-[#0A3D5E]">متوقع عند «بدء التنفيذ» (صرف)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className={erpTableHeadRowClass}>
                <th className={erpTableHeadCellClass}>صنف</th>
                <th className={erpTableHeadCellClass}>مخزن</th>
                <th className={erpTableHeadCellClass}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {rawRows.map((r) => (
                <tr key={r.itemId} className="border-b border-slate-100">
                  <td className="py-1.5">{r.itemName || r.itemId.slice(0, 8)}</td>
                  <td className="py-1.5 text-xs text-slate-500">
                    {fromWarehouseId ? 'مخزن الخامات' : '—'}
                  </td>
                  <td className="py-1.5 text-center font-medium text-rose-700">
                    {fmtQty(-Math.abs(Number(r.quantity) || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[#0A3D5E]">متوقع عند «إنهاء» (استلام)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className={erpTableHeadRowClass}>
                <th className={erpTableHeadCellClass}>صنف</th>
                <th className={erpTableHeadCellClass}>مخزن</th>
                <th className={erpTableHeadCellClass}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {outputRows.map((r) => (
                <tr key={r.itemId} className="border-b border-slate-100">
                  <td className="py-1.5">{r.itemName || r.itemId.slice(0, 8)}</td>
                  <td className="py-1.5 text-xs text-slate-500">
                    {finishedWarehouseId ? 'مخزن المنتج التام' : '—'}
                  </td>
                  <td className="py-1.5 text-center font-medium text-emerald-700">
                    {fmtQty(Math.abs(Number(r.quantity) || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          تُسجَّل الحركات فعلياً عند بدء التنفيذ وإنهاء الأمر.
        </p>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return <TableSkeleton rows={4} columns={5} />;
  }

  const rows = data?.data ?? [];
  if (!rows.length) {
    return <EmptyState title="لا توجد حركات مخزنية مرتبطة بهذا الأمر بعد." />;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={erpTableHeadRowClass}>
          <th className={erpTableHeadCellClass}>النوع</th>
          <th className={erpTableHeadCellClass}>صنف</th>
          <th className={erpTableHeadCellClass}>مخزن</th>
          <th className={erpTableHeadCellClass}>Δ</th>
          <th className={erpTableHeadCellClass}>تكلفة</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const qty = Number(row.quantityDelta) || 0;
          const cost = Math.abs(qty) * Number(row.unitCost ?? 0);
          return (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-1.5 text-xs">
                {MOVEMENT_TYPE_AR[row.movementType] ?? row.movementType}
              </td>
              <td className="py-1.5">
                {row.item?.arabicName ?? row.item?.serial ?? '—'}
              </td>
              <td className="py-1.5 text-xs text-slate-600">
                {row.warehouse?.arabicName ?? row.warehouse?.code ?? '—'}
              </td>
              <td
                className={`py-1.5 text-center font-medium ${qty < 0 ? 'text-rose-700' : qty > 0 ? 'text-emerald-700' : ''}`}
              >
                {fmtQty(qty)}
              </td>
              <td className="py-1.5 text-center tabular-nums">{formatInvoiceMoney(cost)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ManufacturingOrderActivityTab({ order }: { order: ProductionOrderBottomSplitOrder | null }) {
  if (!order?.id) {
    return <p className="text-sm text-slate-500">احفظ الأمر لعرض مسار التنفيذ.</p>;
  }

  const steps: Array<{ label: string; done: boolean; detail?: string }> = [
    {
      label: 'حفظ وتأكيد الأمر',
      done: order.status !== 'DRAFT' && order.status !== 'CANCELLED',
      detail: productionOrderStatusLabel(order.status),
    },
    {
      label: 'بدء التنفيذ — صرف الخامات والقيد',
      done: Boolean(order.materialsIssueJournalEntryId),
    },
    {
      label: 'ترحيل الأجور والمصاريف',
      done: Boolean(order.laborOverheadJournalEntryId),
      detail:
        num(order.totalLaborCost) + num(order.totalOverheadCost) > 0
          ? `مجموع ${formatInvoiceMoney(num(order.totalLaborCost) + num(order.totalOverheadCost))}`
          : undefined,
    },
    {
      label: 'إنهاء — استلام المنتج وقيد الإتمام',
      done: order.status === 'COMPLETED',
      detail:
        order.status === 'COMPLETED' && order.actualQuantity
          ? `كمية منجزة: ${num(order.actualQuantity).toLocaleString('ar-EG')}`
          : undefined,
    },
  ];

  return (
    <ol className="relative border-r-2 border-[#D6EAF3] mr-3 space-y-3">
      {steps.map((step) => (
        <li key={step.label} className="mr-4 pr-2">
          <span
            className={`absolute -right-[7px] mt-1.5 h-3 w-3 rounded-full ${
              step.done ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          />
          <p className={`text-sm ${step.done ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
            {step.label}
          </p>
          {step.detail ? <p className="text-xs text-slate-500 mt-0.5">{step.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function ManufacturingProductionOrderBottomSplit({
  order,
  costSlices,
  loadedProcess,
  fromWarehouseId,
  finishedWarehouseId,
  activeTabId,
  onActiveTabChange,
}: Props) {
  const journalOptions = useMemo(() => {
    if (!order) return [];
    const opts: { id: string; label: string }[] = [];
    if (order.materialsIssueJournalEntryId) {
      const unified =
        order.additionalCostsJournalEntryId &&
        order.additionalCostsJournalEntryId === order.materialsIssueJournalEntryId;
      opts.push({
        id: order.materialsIssueJournalEntryId,
        label: unified ? 'صرف خامات + تكاليف إضافية' : 'صرف الخامات / WIP',
      });
    }
    if (
      order.laborOverheadJournalEntryId &&
      order.laborOverheadJournalEntryId !== order.materialsIssueJournalEntryId
    ) {
      opts.push({ id: order.laborOverheadJournalEntryId, label: 'أجور ومصاريف صناعية' });
    }
    if (order.completionJournalEntryId) {
      opts.push({ id: order.completionJournalEntryId, label: 'إتمام التصنيع' });
    }
    return opts;
  }, [order]);

  const [journalId, setJournalId] = useState<string | null>(null);
  const activeJournalId =
    journalId && journalOptions.some((o) => o.id === journalId)
      ? journalId
      : journalOptions[journalOptions.length - 1]?.id ?? null;

  const netAmount = costSlices.reduce((s, c) => s + Math.max(0, c.value), 0);
  const materials = costSlices.find((c) => c.id === 'materials')?.value ?? 0;
  const labor = costSlices.find((c) => c.id === 'labor')?.value ?? 0;
  const overhead = costSlices.find((c) => c.id === 'overhead')?.value ?? 0;
  const additional = costSlices
    .filter((c) => c.id.startsWith('additional-'))
    .reduce((s, c) => s + Math.max(0, c.value), 0);

  const unitCost =
    order?.status === 'COMPLETED' && num(order.actualQuantity) > 0
      ? num(order.unitCost) || netAmount / num(order.actualQuantity)
      : num(order?.plannedQuantity) > 0
        ? netAmount / num(order?.plannedQuantity)
        : 0;

  const journalEmptyTitle = !order?.id
    ? 'احفظ الأمر أولاً.'
    : journalOptions.length === 0
      ? 'يُنشأ القيد المحاسبي عند «بدء التنفيذ» و«إنهاء» الأمر.'
      : undefined;

  return (
    <ErpDocumentBottomSplit
      financialRows={[
        { label: 'تكلفة المواد الخام', value: materials },
        { label: 'أجور مباشرة', value: labor },
        { label: 'مصاريف صناعية', value: overhead },
        {
          label: 'تكاليف إضافية',
          value: additional,
          show: additional > 0,
        },
        {
          label: 'تكلفة الوحدة (تقدير)',
          value: unitCost,
          show: unitCost > 0,
          suffix: (
            <CalculationInspector
              title="تفصيل تكلفة الإنتاج"
              triggerLabel="تفصيل"
              rows={costSlices
                .filter((s) => s.value > 0)
                .map((s) => ({
                  label: s.label,
                  value: formatInvoiceMoney(s.value),
                }))
                .concat([{ label: 'إجمالي الدفعة', value: formatInvoiceMoney(netAmount) }])}
            />
          ),
        },
      ]}
      netAmount={netAmount}
      netLabel="إجمالي تكلفة الإنتاج"
      showTafqeet={netAmount > 0}
      journalEntryId={activeJournalId}
      journalOptions={journalOptions.length > 1 ? journalOptions : undefined}
      onJournalIdChange={(id) => setJournalId(id)}
      journalEmptyTitle={journalEmptyTitle}
      activeTabId={activeTabId}
      onActiveTabChange={onActiveTabChange}
      financialFooter={
        order?.id ? (
          <p className="text-xs text-slate-500 flex justify-between gap-2">
            <span>مسلسل الأمر</span>
            <span className="font-semibold text-[#0A3D5E]">{order.orderNumber}</span>
          </p>
        ) : null
      }
      tabs={[
        {
          id: 'stock',
          label: 'الأثر المخزني',
          content: (
            <ManufacturingOrderStockTab
              order={order}
              loadedProcess={loadedProcess}
              fromWarehouseId={fromWarehouseId}
              finishedWarehouseId={finishedWarehouseId}
            />
          ),
        },
        {
          id: 'audit',
          label: 'سجل النشاط',
          content: <ManufacturingOrderActivityTab order={order} />,
        },
      ]}
    />
  );
}
