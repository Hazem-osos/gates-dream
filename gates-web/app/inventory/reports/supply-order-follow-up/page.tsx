'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { CustomerSelect } from '@/app/components/form/PartySelect';
import {
  Button,
  FormSectionCard,
  denseTableClass,
  denseTableWrapClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type FollowUpRow = {
  supplyOrderId: string;
  serial?: string | null;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  customerName: string;
  itemName: string;
  itemCode?: string | null;
  warehouseName: string;
  orderQuantity: number;
  stockQuantity: number;
  coveragePercent: number;
  coverageClass: 'none' | 'partial' | 'full';
  isClosed: boolean;
  isCancelled: boolean;
};

type StatusFilter = 'open' | 'closed' | 'cancelled' | 'all';
type CoverageFilter = 'any' | 'full' | 'partial' | 'none';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

export default function SupplyOrderFollowUpReportPage() {
  const [fromDate, setFromDate] = useState(monthStartIso());
  const [toDate, setToDate] = useState(todayIso());
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [coverage, setCoverage] = useState<CoverageFilter>('any');
  const [search, setSearch] = useState('');

  const queryParams = useMemo(
    () => ({
      fromDate,
      toDate,
      status,
      coverage,
      ...(customerId ? { customerId } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [fromDate, toDate, status, coverage, customerId, search]
  );

  const { data, isFetching, refetch } = useApiQuery<{ rows: FollowUpRow[]; total: number }>(
    ['supply-order-follow-up', queryParams],
    '/inventory/supply-orders/reports/follow-up',
    queryParams,
    { staleTime: 0 }
  );

  const rows = data?.data?.rows ?? [];

  return (
    <ErpDocumentLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[#0A3D5E]">تقرير متابعة أوامر التوريد</h1>
          <p className="text-sm text-muted-foreground">
            نسبة التغطية = (كمية الصنف في المخزن ÷ كمية الأمر) × 100
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" isLoading={isFetching} onClick={() => void refetch()}>
          تحديث
        </Button>
      </div>

      <FormSectionCard title="مرشحات التقرير">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <DatePickerWithHijri label="من تاريخ" value={fromDate} onChange={setFromDate} />
          <DatePickerWithHijri label="إلى تاريخ" value={toDate} onChange={setToDate} />
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">العميل</label>
            <CustomerSelect value={customerId} onChange={setCustomerId} className={compactControlClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">بحث</label>
            <input
              className={compactControlClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="مسلسل / عميل / صنف"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">حالة الأمر</label>
            <select
              className={compactControlClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="open">المفتوحة</option>
              <option value="closed">المغلقة</option>
              <option value="cancelled">الملغاة</option>
              <option value="all">الكل</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">تغطية المخزون</label>
            <select
              className={compactControlClass}
              value={coverage}
              onChange={(e) => setCoverage(e.target.value as CoverageFilter)}
            >
              <option value="any">كل النسب</option>
              <option value="full">مغطى بالكامل (100%+)</option>
              <option value="partial">مغطى جزئياً</option>
              <option value="none">غير مغطى</option>
            </select>
          </div>
        </div>
      </FormSectionCard>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-2">
        <p className="mb-2 text-sm text-slate-600">{rows.length} سطر</p>
        <div className={denseTableWrapClass}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                <th className={denseThClass}>المسلسل</th>
                <th className={denseThClass}>العميل</th>
                <th className={denseThClass}>تاريخ الأمر</th>
                <th className={denseThClass}>التسليم المتوقع</th>
                <th className={denseThClass}>الصنف</th>
                <th className={denseThClass}>المخزن</th>
                <th className={denseThClass}>كمية الأمر</th>
                <th className={denseThClass}>كمية المخزن</th>
                <th className={denseThClass}>نسبة تغطية أمر التوريد</th>
                <th className={denseThClass}>حالة الأمر</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={denseTrClass}>
                  <td className={denseTdClass} colSpan={10}>لا توجد بيانات للمرشحات المحددة</td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={`${row.supplyOrderId}-${row.itemName}-${i}`} className={denseTrClass}>
                    <td className={denseTdClass}>
                      <Link
                        href={`/inventory/operations/supply-order?id=${row.supplyOrderId}`}
                        className="text-primary hover:underline"
                      >
                        {row.serial || '—'}
                      </Link>
                    </td>
                    <td className={denseTdClass}>{row.customerName}</td>
                    <td className={denseTdClass}>{String(row.orderDate).slice(0, 10)}</td>
                    <td className={denseTdClass}>
                      {row.expectedDeliveryDate ? String(row.expectedDeliveryDate).slice(0, 10) : '—'}
                    </td>
                    <td className={denseTdClass}>
                      {row.itemCode ? `${row.itemCode} — ` : ''}
                      {row.itemName}
                    </td>
                    <td className={denseTdClass}>{row.warehouseName}</td>
                    <td className={denseTdClass + ' tabular-nums'}>{row.orderQuantity}</td>
                    <td className={denseTdClass + ' tabular-nums'}>{row.stockQuantity}</td>
                    <td className={denseTdClass + ' tabular-nums font-medium'}>{row.coveragePercent}%</td>
                    <td className={denseTdClass}>
                      {row.isCancelled ? 'ملغي' : row.isClosed ? 'مغلق' : 'مفتوح'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ErpDocumentLayout>
  );
}
