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

export type CostVarianceOperationDetail = {
  orderId: string;
  orderNumber: string;
  date: string;
  modelName: string;
  standardQuantity: number;
  actualQuantity: number;
  quantityVariance: number;
  standardPrice: number;
  actualPrice: number;
  priceVariance: number;
  totalVariance: number;
  isPosted: boolean;
};

export type CostVarianceItemLine = {
  lineKey: string;
  lineKind: 'manufactured' | 'raw';
  itemCode: string;
  itemName: string;
  unit: string;
  standardQuantity: number;
  actualQuantity: number;
  quantityVariance: number;
  totalPrice: number;
  variancePercent: number;
  operations: CostVarianceOperationDetail[];
};

export type CostVarianceAdditionalLine = {
  lineKey: string;
  accountLabel: string;
  standardCost: number;
  actualCost: number;
  costVariance: number;
  variancePercent: number;
  operations: CostVarianceOperationDetail[];
};

type CostVariancePayload = {
  itemLines: CostVarianceItemLine[];
  additionalLines: CostVarianceAdditionalLine[];
  varianceTypes: string[];
};

type ReportSummary = {
  totalLines: number;
  totalQuantityVariance: number;
  totalPriceVariance: number;
  operationCount: number;
};

function fmt(n: number, digits = 3) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function OperationDetailsTable({ operations }: { operations: CostVarianceOperationDetail[] }) {
  return (
    <div dir="rtl" className="report-scroll-viewport erp-scroll-x rounded-xl border border-[#D6EAF3] bg-white">
      <table className={mfgTableClass}>
        <thead className={mfgTheadClass}>
          <tr>
            <th className={mfgThClass}>رقم العملية</th>
            <th className={mfgThClass}>التاريخ</th>
            <th className={mfgThClass}>النموذج</th>
            <th className={mfgThClass}>كمية معيارية</th>
            <th className={mfgThClass}>كمية فعلية</th>
            <th className={mfgThClass}>انحراف الكمية</th>
            <th className={mfgThClass}>سعر معياري</th>
            <th className={mfgThClass}>سعر فعلي</th>
            <th className={mfgThClass}>انحراف السعر</th>
            <th className={mfgThClass}>الانحراف</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => (
            <tr key={`${op.orderId}-${op.orderNumber}`} className={mfgTrClass}>
              <td className={mfgTdClass}>{op.orderNumber}</td>
              <td className={mfgTdClass}>{op.date}</td>
              <td className={mfgTdClass}>{op.modelName}</td>
              <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(op.standardQuantity, 2)}</td>
              <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(op.actualQuantity, 2)}</td>
              <td className={cn(mfgTdClass, 'tabular-nums text-rose-700')}>{fmt(op.quantityVariance)}</td>
              <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(op.standardPrice)}</td>
              <td className={cn(mfgTdClass, 'tabular-nums')}>{fmt(op.actualPrice)}</td>
              <td className={cn(mfgTdClass, 'tabular-nums text-rose-700')}>{fmt(op.priceVariance)}</td>
              <td className={cn(mfgTdClass, 'tabular-nums font-semibold text-rose-700')}>{fmt(op.totalVariance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ManufacturingCostVarianceReportResults({
  query,
  showItems,
  showAdditional,
}: {
  query: Record<string, string>;
  showItems: boolean;
  showAdditional: boolean;
}) {
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [selectedAdditionalKey, setSelectedAdditionalKey] = useState<string | null>(null);

  const { data: response, isLoading, isError } = useApiQuery<CostVariancePayload[]>(
    ['manufacturing-cost-variance', query],
    '/manufacturing/reports/cost-variance',
    query
  );

  const payload: CostVariancePayload | null = useMemo(() => {
    const raw = response?.data;
    if (!raw) return null;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw as unknown as CostVariancePayload;
  }, [response?.data]);

  const summary = response?.summary as unknown as ReportSummary | undefined;

  const itemColumns: AppTableColumn<CostVarianceItemLine>[] = useMemo(
    () => [
      { id: 'itemCode', header: 'رقم الصنف', accessor: 'itemCode' },
      { id: 'itemName', header: 'اسم الصنف', accessor: 'itemName' },
      { id: 'unit', header: 'الوحدة', accessor: 'unit' },
      {
        id: 'lineKind',
        header: 'النوع',
        cell: (row) => (row.lineKind === 'manufactured' ? 'مصنّع' : 'أولية'),
      },
      { id: 'standardQuantity', header: 'الكمية المعيارية', accessor: 'standardQuantity', numeric: true, align: 'end' },
      { id: 'actualQuantity', header: 'الكمية الفعلية', accessor: 'actualQuantity', numeric: true, align: 'end' },
      { id: 'quantityVariance', header: 'انحراف الكميات', accessor: 'quantityVariance', numeric: true, align: 'end' },
      { id: 'totalPrice', header: 'اجمالي السعر', accessor: 'totalPrice', numeric: true, align: 'end' },
      { id: 'variancePercent', header: 'نسبة الانحراف', accessor: 'variancePercent', numeric: true, align: 'end' },
    ],
    []
  );

  const additionalColumns: AppTableColumn<CostVarianceAdditionalLine>[] = useMemo(
    () => [
      { id: 'accountLabel', header: 'الحساب', accessor: 'accountLabel' },
      { id: 'standardCost', header: 'التكلفة المعيارية', accessor: 'standardCost', numeric: true, align: 'end' },
      { id: 'actualCost', header: 'التكلفة الفعلية', accessor: 'actualCost', numeric: true, align: 'end' },
      { id: 'costVariance', header: 'انحراف التكلفة', accessor: 'costVariance', numeric: true, align: 'end' },
      { id: 'variancePercent', header: 'النسبة', accessor: 'variancePercent', numeric: true, align: 'end' },
    ],
    []
  );

  if (isError) {
    return (
      <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        تعذر تحميل التقرير
      </p>
    );
  }

  const itemLines = showItems ? (payload?.itemLines ?? []) : [];
  const additionalLines = showAdditional ? (payload?.additionalLines ?? []) : [];

  return (
    <div className="mt-4 space-y-4">
      {summary ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'عمليات التصنيع', value: String(summary.operationCount) },
            { label: 'إجمالي انحراف الكميات', value: fmt(summary.totalQuantityVariance) },
            { label: 'إجمالي انحراف التكلفة', value: fmt(summary.totalPriceVariance) },
            { label: 'عدد الأسطر', value: String(summary.totalLines) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-[#D6EAF3] bg-white px-3 py-2 text-right">
              <p className="text-[11px] text-slate-500">{card.label}</p>
              <p className="text-sm font-bold tabular-nums text-[#0A3D5E]">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {showItems ? (
        <MfgTableCard title="انحراف الأصناف (مصنّعة / أولية)">
          <AppTable
            columns={itemColumns}
            data={itemLines}
            isLoading={isLoading}
            getRowKey={(row) => row.lineKey}
            onRowClick={(row) =>
              setSelectedItemKey((prev) => (prev === row.lineKey ? null : row.lineKey))
            }
            rowClassName={(row) => cn(selectedItemKey === row.lineKey && 'bg-[#E8F4FA]')}
            exportFileName="cost-variance-items"
            emptyTitle="لا توجد أصناف في الفترة"
          />
          {itemLines.length > 0 ? (
            <div className="grid grid-cols-2 gap-px border-t border-[#D6EAF3] bg-[#EEF5F9] sm:grid-cols-6">
              <div className={cn(mfgTdClass, 'bg-[#E8F4FA] font-bold')}>الإجماليات</div>
              <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold')}>
                {fmt(itemLines.reduce((s, r) => s + r.standardQuantity, 0), 2)}
              </div>
              <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold')}>
                {fmt(itemLines.reduce((s, r) => s + r.actualQuantity, 0), 2)}
              </div>
              <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold text-rose-700')}>
                {fmt(itemLines.reduce((s, r) => s + r.quantityVariance, 0))}
              </div>
              <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold text-rose-700')}>
                {fmt(itemLines.reduce((s, r) => s + r.totalPrice, 0))}
              </div>
              <div className={cn(mfgTdClass, 'bg-white')} />
            </div>
          ) : null}
        </MfgTableCard>
      ) : null}

      {showItems && selectedItemKey ? (
        <MfgTableCard title="تفاصيل عمليات التصنيع — صنف مختار">
          <OperationDetailsTable
            operations={itemLines.find((l) => l.lineKey === selectedItemKey)?.operations ?? []}
          />
        </MfgTableCard>
      ) : null}

      {showAdditional ? (
        <MfgTableCard title="انحراف التكاليف الإضافية">
          <AppTable
            columns={additionalColumns}
            data={additionalLines}
            isLoading={isLoading}
            getRowKey={(row) => row.lineKey}
            onRowClick={(row) =>
              setSelectedAdditionalKey((prev) => (prev === row.lineKey ? null : row.lineKey))
            }
            rowClassName={(row) => cn(selectedAdditionalKey === row.lineKey && 'bg-[#E8F4FA]')}
            exportFileName="cost-variance-additional"
            emptyTitle="لا توجد تكاليف إضافية"
          />
          {additionalLines.length > 0 ? (
            <div className="grid grid-cols-2 gap-px border-t border-[#D6EAF3] bg-[#EEF5F9] sm:grid-cols-5">
              <div className={cn(mfgTdClass, 'bg-[#E8F4FA] font-bold')}>الإجماليات</div>
              <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold')}>
                {fmt(additionalLines.reduce((s, r) => s + r.standardCost, 0))}
              </div>
              <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold')}>
                {fmt(additionalLines.reduce((s, r) => s + r.actualCost, 0))}
              </div>
              <div className={cn(mfgTdClass, 'bg-white tabular-nums font-semibold text-rose-700')}>
                {fmt(additionalLines.reduce((s, r) => s + r.costVariance, 0))}
              </div>
              <div className={cn(mfgTdClass, 'bg-white')} />
            </div>
          ) : null}
        </MfgTableCard>
      ) : null}

      {showAdditional && selectedAdditionalKey ? (
        <MfgTableCard title="تفاصيل عمليات التصنيع — حساب إضافي">
          <OperationDetailsTable
            operations={
              additionalLines.find((l) => l.lineKey === selectedAdditionalKey)?.operations ?? []
            }
          />
        </MfgTableCard>
      ) : null}
    </div>
  );
}
