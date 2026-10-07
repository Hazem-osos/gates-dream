'use client';

import Link from 'next/link';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  MfgMetric,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { StatusBadge } from '@/components/ui';

type ReportRow = {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  bomName: string;
  finishedItemName: string;
  finishedItemSerial: string;
  plannedQuantity: number;
  actualQuantity: number | null;
  warehouseRawName: string;
  warehouseFinishedName: string;
  stage: string;
  description: string;
  totalMaterialCost: number;
  materialsPosted: boolean;
  completionPosted: boolean;
  createdAt: string;
  completedAt: string | null;
};

type ReportSummary = {
  total: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
};

function toneForStatus(status: string) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'IN_PROGRESS') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'warning' as const;
}

export function ManufacturingOrderStatusReportResults({
  query,
}: {
  query: Record<string, string>;
}) {
  const { data: response, isLoading, isError } = useApiQuery<ReportRow[]>(
    ['manufacturing-order-status-report', query],
    '/manufacturing/reports/order-status',
    query
  );

  const rows = response?.data ?? [];
  const summary = response?.summary as ReportSummary | undefined;

  if (isLoading) {
    return <p className="text-sm text-slate-500">جاري تحميل التقرير…</p>;
  }
  if (isError) {
    return <p className="text-sm text-rose-600">تعذر تحميل تقرير مواقف الأوامر</p>;
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MfgMetric label="إجمالي الأوامر" value={summary.total} />
          <MfgMetric label="تم التأكيد" value={summary.confirmed} tone="warn" />
          <MfgMetric label="قيد التنفيذ" value={summary.inProgress} />
          <MfgMetric label="منتهي" value={summary.completed} tone="ok" />
          <MfgMetric label="ملغي" value={summary.cancelled} tone="bad" />
        </div>
      ) : null}

      <MfgTableCard title="مواقف أوامر التصنيع">
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>المسلسل</th>
              <th className={mfgThClass}>الموقف</th>
              <th className={mfgThClass}>النموذج</th>
              <th className={mfgThClass}>الصنف الناتج</th>
              <th className={mfgThClass}>الكمية المخططة</th>
              <th className={mfgThClass}>الكمية الفعلية</th>
              <th className={mfgThClass}>مخزن الخامات</th>
              <th className={mfgThClass}>مخزن النهائي</th>
              <th className={mfgThClass}>المرحلة</th>
              <th className={mfgThClass}>صرف خامات</th>
              <th className={mfgThClass}>إنهاء</th>
              <th className={mfgThClass}>فتح</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-sm text-slate-500">
                  لا توجد أوامر مطابقة للمرشحات
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={mfgTrClass}>
                  <td className={`${mfgTdClass} font-mono font-semibold`}>{row.orderNumber}</td>
                  <td className={mfgTdClass}>
                    <StatusBadge compact label={row.statusLabel} tone={toneForStatus(row.status)} />
                  </td>
                  <td className={mfgTdClass}>{row.bomName || '—'}</td>
                  <td className={mfgTdClass}>
                    {row.finishedItemName}
                    {row.finishedItemSerial ? ` (${row.finishedItemSerial})` : ''}
                  </td>
                  <td className={`${mfgTdClass} tabular-nums`}>
                    {row.plannedQuantity.toLocaleString('ar-EG')}
                  </td>
                  <td className={`${mfgTdClass} tabular-nums`}>
                    {row.actualQuantity != null ? row.actualQuantity.toLocaleString('ar-EG') : '—'}
                  </td>
                  <td className={mfgTdClass}>{row.warehouseRawName || '—'}</td>
                  <td className={mfgTdClass}>{row.warehouseFinishedName || '—'}</td>
                  <td className={mfgTdClass}>{row.stage || '—'}</td>
                  <td className={mfgTdClass}>{row.materialsPosted ? 'نعم' : '—'}</td>
                  <td className={mfgTdClass}>{row.completionPosted ? 'نعم' : '—'}</td>
                  <td className={mfgTdClass}>
                    <Link
                      href={`/manufacturing/operations/operation?orderId=${row.id}`}
                      className="text-sm font-semibold text-[#0E78AA] hover:underline"
                    >
                      عرض
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </MfgTableCard>
    </div>
  );
}
