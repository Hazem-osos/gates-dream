'use client';

import { useMemo, useState } from 'react';
import { AppTable, type AppTableColumn } from '@/app/components/ui/AppTable';
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
    { id: 'outputs' as const, label: 'المواد المصنعة' },
    { id: 'raws' as const, label: 'المواد الأولية' },
    { id: 'additional' as const, label: 'التكاليف الإضافية' },
  ];

  const lines =
    tab === 'outputs' ? row.details.outputs : tab === 'raws' ? row.details.raws : row.details.additionalCosts;

  const nameHeader =
    tab === 'outputs' ? 'المواد المصنعة' : tab === 'raws' ? 'المواد الأولية' : 'التكاليف الإضافية';

  const showQtyCols = tab !== 'additional';

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
              {showQtyCols ? <th className={mfgThClass}>الكمية القياسية</th> : null}
              {showQtyCols ? <th className={mfgThClass}>الكمية الفعلية</th> : null}
              <th className={mfgThClass}>السعر القياسي</th>
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

export function ManufacturingMovementsReportResults({
  query,
  showAnalyticalReport,
}: {
  query: Record<string, string>;
  showAnalyticalReport: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: response, isLoading, isError } = useApiQuery<MfgMovementMasterRow[]>(
    ['manufacturing-movements-report', query],
    '/manufacturing/reports/manufacturing-movements',
    query
  );

  const rows = response?.data ?? [];
  const summary = response?.summary as unknown as ReportSummary | undefined;

  const columns: AppTableColumn<MfgMovementMasterRow>[] = useMemo(
    () => [
      { id: 'rowNumber', header: 'الرقم', accessor: 'rowNumber', numeric: true, align: 'end' },
      { id: 'modelName', header: 'النموذج', accessor: 'modelName' },
      { id: 'date', header: 'التاريخ', accessor: 'date' },
      { id: 'quantity', header: 'الكمية', accessor: 'quantity', numeric: true, align: 'end' },
      { id: 'unitCost', header: 'الكلفة الإفرادية', accessor: 'unitCost', numeric: true, align: 'end' },
      { id: 'totalCost', header: 'الكلفة الإجمالية', accessor: 'totalCost', numeric: true, align: 'end' },
      { id: 'variance', header: 'الانحراف', accessor: 'variance', numeric: true, align: 'end' },
      { id: 'batchNumber', header: 'رقم الطبخة', accessor: 'batchNumber' },
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

  const displayRows = showAnalyticalReport ? rows : rows;

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

      <MfgTableCard title="حركات التصنيع — اضغط على سطر لعرض التحليل">
        <AppTable
          columns={columns}
          data={displayRows}
          isLoading={isLoading}
          getRowKey={(row) => row.id}
          onRowClick={(row) => setSelectedId((prev) => (prev === row.id ? null : row.id))}
          rowClassName={(row) =>
            cn(
              selectedId === row.id && !showAnalyticalReport && 'bg-[#E8F4FA]',
              !row.isPosted && 'opacity-90'
            )
          }
          exportFileName="manufacturing-movements"
          emptyTitle="لا توجد حركات"
          emptyDescription="غيّر الفترة أو المرشحات ثم اعرض التقرير"
        />
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

      {showAnalyticalReport
        ? rows.map((row) => (
            <MfgTableCard key={row.id} title={`تحليل — ${row.modelName} (${row.orderNumber})`}>
              <DetailTabs row={row} />
            </MfgTableCard>
          ))
        : null}
    </div>
  );
}
