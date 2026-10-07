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
import { workOrderStatusTone, manufacturingWorkOrderStatusLabel } from '@/lib/manufacturing/work-order-status';

type ReportRow = {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  percentComplete: number;
  lines: Array<{ itemName: string; quantity: number }>;
  workOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    percentComplete: number;
    requiredTotal: number;
    completedTotal: number;
    remainingTotal: number;
    bomPlans: Array<{
      bomName: string;
      requiredQuantity: number;
      completedQuantity: number;
      remainingQuantity: number;
      percentComplete: number;
    }>;
  }>;
};

export function ManufacturingSalesOrderTrackingResults({
  query,
}: {
  query: Record<string, string>;
}) {
  const { data: response, isLoading, isError } = useApiQuery<ReportRow[]>(
    ['mfg-sales-order-tracking', query],
    '/manufacturing/reports/sales-order-tracking',
    query
  );

  const rows = response?.data ?? [];
  const summary = response?.summary as
    | { total: number; withWorkOrder: number; withoutWorkOrder: number }
    | undefined;

  if (isLoading) return <p className="text-sm text-slate-500">جاري تحميل التقرير…</p>;
  if (isError) return <p className="text-sm text-rose-600">تعذر تحميل التقرير</p>;

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MfgMetric label="أوامر البيع" value={summary.total} />
          <MfgMetric label="بأمر شغل" value={summary.withWorkOrder} tone="ok" />
          <MfgMetric label="بدون أمر شغل" value={summary.withoutWorkOrder} tone="warn" />
        </div>
      ) : null}

      {rows.map((row) => (
        <MfgTableCard
          key={row.id}
          title={`أمر بيع ${row.invoiceNumber || '—'}`}
          toolbar={
            <span className="text-xs font-semibold text-[#0A3D5E]">
              تقدم التصنيع: {row.percentComplete.toLocaleString('ar-EG')}%
            </span>
          }
        >
          <div className="space-y-3 p-4 text-sm">
            <p className="text-slate-600">
              {row.date} · {row.customerName || '—'}
              <Link
                href={`/inventory/operations/sales-order?id=${encodeURIComponent(row.id)}`}
                className="ms-2 text-[#0E78AA] underline-offset-2 hover:underline"
              >
                فتح الأمر
              </Link>
            </p>
            <table className={mfgTableClass}>
              <thead className={mfgTheadClass}>
                <tr>
                  <th className={mfgThClass}>صنف أمر البيع</th>
                  <th className={mfgThClass}>الكمية</th>
                </tr>
              </thead>
              <tbody>
                {row.lines.map((l, i) => (
                  <tr key={i} className={mfgTrClass}>
                    <td className={mfgTdClass}>{l.itemName}</td>
                    <td className={mfgTdClass}>{l.quantity.toLocaleString('ar-EG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {row.workOrders.length === 0 ? (
              <p className="text-amber-700">لا يوجد أمر شغل مرتبط</p>
            ) : (
              row.workOrders.map((wo) => (
                <div key={wo.id} className="rounded-xl border border-[#E6F0F7] bg-[#F8FBFD] p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#0A3D5E]">أمر شغل {wo.orderNumber}</span>
                    <StatusBadge
                      tone={workOrderStatusTone(wo.status)}
                      label={manufacturingWorkOrderStatusLabel(wo.status)}
                    />
                    <span>{wo.percentComplete.toLocaleString('ar-EG')}%</span>
                    <Link
                      href={`/manufacturing/operations/production-planning?id=${encodeURIComponent(wo.id)}`}
                      className="text-[#0E78AA] underline-offset-2 hover:underline"
                    >
                      التخطيط
                    </Link>
                  </div>
                  <table className={mfgTableClass}>
                    <thead className={mfgTheadClass}>
                      <tr>
                        <th className={mfgThClass}>نموذج</th>
                        <th className={mfgThClass}>مطلوب</th>
                        <th className={mfgThClass}>منفّذ</th>
                        <th className={mfgThClass}>متبقي</th>
                        <th className={mfgThClass}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wo.bomPlans.map((p, i) => (
                        <tr key={i} className={mfgTrClass}>
                          <td className={mfgTdClass}>{p.bomName}</td>
                          <td className={mfgTdClass}>{p.requiredQuantity.toLocaleString('ar-EG')}</td>
                          <td className={mfgTdClass}>{p.completedQuantity.toLocaleString('ar-EG')}</td>
                          <td className={mfgTdClass}>{p.remainingQuantity.toLocaleString('ar-EG')}</td>
                          <td className={mfgTdClass}>{p.percentComplete.toLocaleString('ar-EG')}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </MfgTableCard>
      ))}
    </div>
  );
}
