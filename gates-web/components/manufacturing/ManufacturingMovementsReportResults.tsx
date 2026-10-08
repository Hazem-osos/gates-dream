'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus } from 'lucide-react';
import { AppTable, type AppTableColumn } from '@/app/components/ui/AppTable';
import {
  formatManufacturingOrderSerial,
  manufacturingOrderHref,
} from '@/lib/manufacturing/order-serial';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { cn } from '@/lib/utils';

export type MfgMovementDetailRow = {
  key: string;
  label: string;
  unit: string;
  standardQuantity: number;
  actualQuantity: number;
  standardPrice: number;
  actualPrice: number;
  quantityVariance: number;
  priceVariance: number;
  totalVariance: number;
};

export type MfgMovementMasterRow = {
  id: string;
  rowNumber: number;
  orderNumber: string;
  bomId: string;
  modelName: string;
  date: string;
  stage: string;
  costCenter: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  materialCost: number;
  additionalCost: number;
  variance: number;
  batchNumber: string;
  productionTime: number;
  isPosted: boolean;
  status: string;
  details: {
    outputs: MfgMovementDetailRow[];
    raws: MfgMovementDetailRow[];
    additionalCosts: MfgMovementDetailRow[];
  };
};

type ReportSummary = {
  totalOperations: number;
  totalQuantity: number;
  totalCost: number;
  totalVariance: number;
  totalMaterialCost: number;
  totalAdditionalCost: number;
  postedCount: number;
  unpostedCount: number;
};

function fmt(n: number, digits = 3) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function DetailTabs({ row }: { row: MfgMovementMasterRow }) {
  const [tab, setTab] = useState<'outputs' | 'raws' | 'additional'>('outputs');

  const tabs = [
    { id: 'outputs' as const, label: 'أصناف الناتج' },
    { id: 'raws' as const, label: 'الخامات الأولية' },
    { id: 'additional' as const, label: 'التكاليف الإضافية' },
  ];

  const lines =
    tab === 'outputs' ? row.details.outputs : tab === 'raws' ? row.details.raws : row.details.additionalCosts;

  const nameHeader =
    tab === 'outputs' ? 'أصناف الناتج' : tab === 'raws' ? 'الخامات الأولية' : 'التكاليف الإضافية';

  /** الخامات والتكاليف الإضافية وأصناف الناتج — نفس أعمدة الكمية/السعر المعيارية والفعلية */
  const showQtyCols = true;

  return (
    <div className="border-t border-[#D6EAF3] bg-[#F8FBFD] px-3 py-3">
      <div className="mb-2 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              tab === t.id ? 'bg-[#0E78AA] text-white' : 'bg-white text-[#0A3D5E] border border-[#D6EAF3]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div dir="rtl" className="report-scroll-viewport erp-scroll-x rounded-xl border border-[#D6EAF3] bg-white">
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>{nameHeader}</th>
              {showQtyCols ? <th className={mfgThClass}>الوحدة</th> : null}
              {showQtyCols ? <th className={mfgThClass}>الكمية المعيارية</th> : null}
              {showQtyCols ? <th className={mfgThClass}>الكمية الفعلية</th> : null}
              <th className={mfgThClass}>السعر المعياري</th>
              <th className={mfgThClass}>السعر الفعلي</th>
              {showQtyCols ? <th className={mfgThClass}>انحراف الكمية</th> : null}
              <th className={mfgThClass}>انحراف السعر</th>
              <th className={mfgThClass}>الانحراف</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={showQtyCols ? 9 : 5} className={cn(mfgTdClass, 'text-center text-slate-500')}>
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.key} className={mfgTrClass}>
                  <td className={mfgTdClass}>{line.label}</td>
                  {showQtyCols ? <td className={mfgTdClass}>{line.unit}</td> : null}
                  {showQtyCols ? <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(line.standardQuantity, 2)}</td> : null}
                  {showQtyCols ? <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(line.actualQuantity, 2)}</td> : null}
                  <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(line.standardPrice)}</td>
                  <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(line.actualPrice)}</td>
                  {showQtyCols ? (
                    <td className={cn(mfgTdClass, 'tabular-nums text-rose-700')}>{fmt(line.quantityVariance)}</td>
                  ) : null}
                  <td className={cn(mfgTdClass, 'tabular-nums text-rose-700')}>{fmt(line.priceVariance)}</td>
                  <td className={cn(mfgTdClass, 'tabular-nums font-semibold text-rose-700')}>{fmt(line.totalVariance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toggleExpandedId(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function ManufacturingMovementsReportResults({
  query,
  showAnalyticalReport,
}: {
  query: Record<string, string>;
  showAnalyticalReport: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => toggleExpandedId(prev, id));
  }, []);

  const { data: response, isLoading, isError } = useApiQuery<MfgMovementMasterRow[]>(
    ['manufacturing-movements-report', query],
    '/manufacturing/reports/manufacturing-movements',
    query
  );

  const rows = response?.data ?? [];
  const summary = response?.summary as unknown as ReportSummary | undefined;

  const queryKey = useMemo(() => JSON.stringify(query), [query]);
  useEffect(() => {
    setExpandedIds(new Set());
    setSelectedId(null);
  }, [queryKey]);

  const columns: AppTableColumn<MfgMovementMasterRow>[] = useMemo(
    () => [
      {
        id: 'orderNumber',
        header: 'رقم أمر التصنيع',
        cell: (row) => {
          const href = manufacturingOrderHref(row.id);
          const label = formatManufacturingOrderSerial(row.orderNumber);
          if (!href) return label;
          return (
            <Link href={href} className="font-mono text-[#0E78AA] hover:underline" onClick={(e) => e.stopPropagation()}>
              {label}
            </Link>
          );
        },
      },
      { id: 'modelName', header: 'النموذج', accessor: 'modelName' },
      { id: 'date', header: 'التاريخ', accessor: 'date' },
      { id: 'quantity', header: 'الكمية', accessor: 'quantity', numeric: true, align: 'end' },
      { id: 'unitCost', header: 'تكلفة القطعة', accessor: 'unitCost', numeric: true, align: 'end' },
      { id: 'totalCost', header: 'إجمالي التكلفة', accessor: 'totalCost', numeric: true, align: 'end' },
      { id: 'variance', header: 'الانحراف', accessor: 'variance', numeric: true, align: 'end' },
      { id: 'batchNumber', header: 'رقم التشغيل', accessor: 'batchNumber' },
      {
        id: 'productionTime',
        header: 'زمن الإنتاج',
        accessor: 'productionTime',
        numeric: true,
        align: 'end',
      },
      { id: 'stage', header: 'المرحلة', accessor: 'stage' },
      { id: 'costCenter', header: 'مركز التكلفة', accessor: 'costCenter' },
      {
        id: 'status',
        header: 'الحالة',
        cell: (row) => (row.isPosted ? 'مرحّل' : 'غير مرحّل'),
      },
    ],
    []
  );

  const masterColCount = columns.length + (showAnalyticalReport ? 1 : 0);

  if (isError) {
    return (
      <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        تعذر تحميل التقرير
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {summary ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: 'عدد العمليات', value: String(summary.totalOperations) },
            { label: 'إجمالي الكمية', value: fmt(summary.totalQuantity, 2) },
            { label: 'إجمالي التكلفة', value: fmt(summary.totalCost) },
            { label: 'إجمالي الانحراف', value: fmt(summary.totalVariance) },
            { label: 'مواد خام', value: fmt(summary.totalMaterialCost) },
            { label: 'تكاليف إضافية', value: fmt(summary.totalAdditionalCost) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-[#D6EAF3] bg-white px-3 py-2 text-right">
              <p className="text-[11px] text-slate-500">{card.label}</p>
              <p className="text-sm font-bold tabular-nums text-[#0A3D5E]">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <MfgTableCard
        title={
          showAnalyticalReport
            ? 'حركات التصنيع — كل سطر رأس عملية: اضغط + لفتح التحليل'
            : 'حركات التصنيع — اضغط على سطر لعرض التحليل'
        }
      >
        {showAnalyticalReport ? (
          <div dir="rtl" className="report-scroll-viewport erp-scroll-x">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">جاري تحميل التقرير…</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                لا توجد حركات — غيّر الفترة أو المرشحات ثم اعرض التقرير
              </p>
            ) : (
              <table className={mfgTableClass}>
                <thead className={mfgTheadClass}>
                  <tr>
                    <th className={cn(mfgThClass, 'w-12 text-center')}> </th>
                    {columns.map((col) => (
                      <th key={col.id} className={mfgThClass}>{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const open = expandedIds.has(row.id);
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className={cn(
                            mfgTrClass,
                            'cursor-pointer',
                            open && 'bg-[#E8F4FA]',
                            !row.isPosted && 'opacity-90'
                          )}
                          onClick={() => toggleExpanded(row.id)}
                        >
                          <td className={cn(mfgTdClass, 'text-center')}>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#D6EAF3] bg-white text-[#0E78AA] shadow-sm hover:bg-[#F0F9FF]"
                              aria-expanded={open}
                              aria-label={open ? 'إخفاء التحليل' : 'عرض التحليل'}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(row.id);
                              }}
                            >
                              {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </button>
                          </td>
                          {columns.map((col) => (
                            <td key={col.id} className={mfgTdClass}>
                              {col.cell
                                ? col.cell(row, rowIndex)
                                : col.accessor != null
                                  ? String((row as Record<string, unknown>)[col.accessor as string] ?? '')
                                  : ''}
                            </td>
                          ))}
                        </tr>
                        {open ? (
                          <tr className="bg-[#F8FBFD]">
                            <td colSpan={masterColCount} className="p-0">
                              <DetailTabs row={row} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <AppTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            getRowKey={(row) => row.id}
            onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
            rowClassName={(row) =>
              cn(selectedId === row.id && 'bg-[#E8F4FA]', !row.isPosted && 'opacity-90')
            }
            exportFileName="manufacturing-movements"
            emptyTitle="لا توجد حركات"
            emptyDescription="غيّر الفترة أو المرشحات ثم اعرض التقرير"
          />
        )}
        {summary && rows.length > 0 ? (
          <div className="grid grid-cols-2 gap-px border-t border-[#D6EAF3] bg-[#EEF5F9] sm:grid-cols-4 lg:grid-cols-8">
            <div className={cn(mfgTdClass, 'bg-[#E8F4FA] font-bold text-[#0A3D5E]')}>الإجماليات</div>
            <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold')}>{fmt(summary.totalQuantity, 2)}</div>
            <div className={cn(mfgTdClass, 'bg-white')} />
            <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold')}>{fmt(summary.totalCost)}</div>
            <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold text-rose-700')}>
              {fmt(summary.totalVariance)}
            </div>
            <div className={cn(mfgTdClass, 'bg-white col-span-3 hidden lg:block')} />
          </div>
        ) : null}
      </MfgTableCard>

      {!showAnalyticalReport && selectedId ? (() => {
        const selected = rows.find((r) => r.id === selectedId);
        if (!selected) return null;
        return (
          <MfgTableCard title="تحليل العملية المختارة">
            <DetailTabs row={selected} />
          </MfgTableCard>
        );
      })() : null}
    </div>
  );
}
