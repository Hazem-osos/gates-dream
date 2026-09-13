'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ReportFilterDate,
  ReportFilterField,
  ReportFilterPartySelect,
  ReportFilterSelect,
  ReportFilterPageShell,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';
import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import { useApiQuery } from '@/lib/hooks/useApi';
import { SOURCE_TYPE_OPTIONS } from '@/lib/invoices/sourceDocument';

type MovementRow = {
  id: string;
  sourceType: string;
  sourceTypeLabel: string;
  sourceNumber: string;
  sourceDate: string | null;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  partyName: string;
  sourceTotal: number;
  invoiceTotal: number;
  delta: number;
  changePercent: number;
  turnaroundDays: number | null;
  status: 'كامل' | 'جزئي' | 'ملغي';
  operatorName: string;
  invoicePreviewPath: string;
  sourcePreviewPath: string | null;
};

type MovementSummary = {
  convertedCount: number;
  invoicedTotal: number;
  openSourceCount: number;
  conversionRate: number;
};

const defaultFilters = () => ({
  fromDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
  toDate: new Date().toISOString().split('T')[0],
  sourceType: '',
  customerId: '',
  supplierId: '',
  status: '',
  search: '',
});

function money(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG');
}

const statusClass: Record<MovementRow['status'], string> = {
  كامل: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  جزئي: 'bg-amber-50 text-amber-700 border-amber-200',
  ملغي: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function AnalyticalInvoicesPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);

  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const queryParams = useMemo(
    () => ({
      fromDate: applied.fromDate || undefined,
      toDate: applied.toDate || undefined,
      sourceType: applied.sourceType || undefined,
      partyId: applied.customerId || applied.supplierId || undefined,
      status: applied.status || undefined,
      search: applied.search || undefined,
      page: 1,
      limit: 100,
    }),
    [applied]
  );

  const { data, isFetching, error } = useApiQuery<MovementRow[]>(
    ['analytical-invoice-movement', queryParams],
    '/reports/analytical-invoice-movement',
    queryParams
  );

  const rows = data?.data ?? [];
  const summary = (data?.summary ?? {}) as Partial<MovementSummary>;
  const convertedCount = Number(summary.convertedCount ?? 0);
  const invoicedTotal = Number(summary.invoicedTotal ?? 0);
  const conversionRate = Number(summary.conversionRate ?? 0);

  return (
    <ReportFilterPageShell
      title="تقرير الحركة التحليلية للفواتير"
      description="تتبع تحويل عروض الأسعار وأوامر البيع والشراء إلى فواتير، مع مقارنة القيم وحالة التحويل."
      breadcrumbs={[
        { label: 'المخزون', href: '/inventory' },
        { label: 'التقارير', href: '/inventory/reports' },
        { label: 'الحركة التحليلية للفواتير' },
      ]}
      error={error?.message}
    >
      <UnifiedReportFilterCard
        icon="📑"
        title="الحركة التحليلية للفواتير"
        showTitle={false}
        onPreview={() => setApplied(filters)}
        onReset={() => {
          const next = defaultFilters();
          setFilters(next);
          setApplied(next);
        }}
      >
        <ReportFilterDate
          label="من تاريخ"
          value={filters.fromDate}
          onChange={(fromDate) => patch({ fromDate })}
        />
        <ReportFilterDate
          label="إلى تاريخ"
          value={filters.toDate}
          onChange={(toDate) => patch({ toDate })}
        />
        <ReportFilterSelect
          label="القسم"
          value={filters.sourceType}
          onChange={(sourceType) => patch({ sourceType })}
          options={[
            { value: '', label: 'كل الأقسام' },
            ...SOURCE_TYPE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: `${opt.icon} ${opt.label}`,
            })),
          ]}
          placeholder="كل الأقسام"
        />
        <ReportFilterPartySelect
          label="العميل"
          kind="CUSTOMER"
          value={filters.customerId}
          onChange={(customerId) => patch({ customerId, supplierId: customerId ? '' : filters.supplierId })}
          emptyLabel="كل العملاء"
        />
        <ReportFilterPartySelect
          label="المورد"
          kind="SUPPLIER"
          value={filters.supplierId}
          onChange={(supplierId) => patch({ supplierId, customerId: supplierId ? '' : filters.customerId })}
          emptyLabel="كل الموردين"
        />
        <ReportFilterSelect
          label="حالة التحويل"
          value={filters.status}
          onChange={(status) => patch({ status })}
          options={[
            { value: '', label: 'كل الحالات' },
            { value: 'كامل', label: 'كامل' },
            { value: 'جزئي', label: 'جزئي' },
            { value: 'ملغي', label: 'ملغي' },
          ]}
        />
        <ReportFilterField label="بحث">
          <input
            className={reportFilterInputClass}
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="رقم المستند أو الفاتورة أو الجهة"
          />
        </ReportFilterField>
      </UnifiedReportFilterCard>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="إجمالي المستندات المحولة" value={convertedCount.toLocaleString('ar-EG')} />
        <SummaryCard title="إجمالي قيمة الفواتير الناتجة" value={`${money(invoicedTotal)} ج.م`} />
        <SummaryCard title="نسبة التحويل" value={`${conversionRate.toFixed(1)}٪`} />
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-[#D6EAF3] bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F6FBFD] text-[#0A3D5E]">
            <tr>
              <th className="px-3 py-3 text-right font-semibold">نوع المستند الأصلي</th>
              <th className="px-3 py-3 text-right font-semibold">رقم وتاريخ المستند</th>
              <th className="px-3 py-3 text-right font-semibold">رقم وتاريخ الفاتورة</th>
              <th className="px-3 py-3 text-right font-semibold">العميل / الجهة</th>
              <th className="px-3 py-3 text-right font-semibold">قيمة المستند</th>
              <th className="px-3 py-3 text-right font-semibold">قيمة الفاتورة</th>
              <th className="px-3 py-3 text-right font-semibold">الفارق / النسبة</th>
              <th className="px-3 py-3 text-right font-semibold">المسؤول</th>
              <th className="px-3 py-3 text-right font-semibold">الحالة</th>
              <th className="px-3 py-3 text-right font-semibold">معاينة</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  جاري تحميل الحركة التحليلية…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  لا توجد تحويلات مطابقة للفلاتر الحالية
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-3 whitespace-nowrap">{row.sourceTypeLabel}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.sourceNumber || '—'}</div>
                    <div className="text-xs text-slate-400">{formatDate(row.sourceDate)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{row.invoiceNumber}</div>
                    <div className="text-xs text-slate-400">
                      {formatDate(row.invoiceDate)}
                      {row.turnaroundDays != null ? ` · ${row.turnaroundDays} يوم` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-3">{row.partyName}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{money(row.sourceTotal)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{money(row.invoiceTotal)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {money(row.delta)}{' '}
                    <span className="text-xs text-slate-400">({row.changePercent.toFixed(1)}٪)</span>
                  </td>
                  <td className="px-3 py-3">{row.operatorName}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      <Link href={row.invoicePreviewPath} className="text-[#0E79AA] font-semibold hover:underline">
                        معاينة الفاتورة
                      </Link>
                      {row.sourcePreviewPath ? (
                        <Link href={row.sourcePreviewPath} className="text-slate-500 hover:underline">
                          معاينة المستند الأصلي
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportFilterPageShell>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D6EAF3] bg-white px-4 py-4 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-bold text-[#0A3D5E]">{value}</div>
    </div>
  );
}
