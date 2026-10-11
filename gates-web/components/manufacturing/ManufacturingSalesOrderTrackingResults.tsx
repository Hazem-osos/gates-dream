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
  dueDate: string;
  description: string;
  customerName: string;
  warehouseName: string;
  percentComplete: number;
  lines: Array<{
    itemName: string;
    itemSerial: string;
    quantity: number;
    lineNotes: string;
    warehouseName: string;
    availableQuantity: number | null;
  }>;
  workOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    percentComplete: number;
    requiredTotal: number;
    completedTotal: number;
    inProgressTotal: number;
    remainingTotal: number;
    bomPlans: Array<{
      bomName: string;
      requiredQuantity: number;
      completedQuantity: number;
      inProgressQuantity: number;
      remainingQuantity: number;
      percentComplete: number;
    }>;
  }>;
};

function formatDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ManufacturingSalesOrderTrackingResults({
  query,
  showManufacturingDetails,
}: {
  query: Record<string, string>;
  showManufacturingDetails: boolean;
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

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">لا توجد أوامر بيع مطابقة للمرشحات.</p>;
  }

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
            showManufacturingDetails && row.workOrders.length > 0 ? (
              <span className="text-xs font-semibold text-[#0A3D5E]">
                تقدم التصنيع: {row.percentComplete.toLocaleString('ar-EG')}%
              </span>
            ) : null
          }
        >
          <div className="space-y-3 p-4 text-sm">
            <div className="grid gap-1 text-slate-700 sm:grid-cols-2">
              <p>
                <span className="text-slate-500">العميل:</span> {row.customerName || '—'}
              </p>
              <p>
                <span className="text-slate-500">المخزن:</span> {row.warehouseName || '—'}
              </p>
              <p>
                <span className="text-slate-500">تاريخ الأمر:</span> {formatDate(row.date)}
              </p>
              <p>
                <span className="text-slate-500">التسليم المتوقع:</span>{' '}
                {row.dueDate ? formatDate(row.dueDate) : '—'}
              </p>
              {row.description ? (
                <p className="sm:col-span-2">
                  <span className="text-slate-500">الشرح:</span> {row.description}
                </p>
              ) : null}
            </div>
            <Link
              href={`/inventory/operations/sales-order?id=${encodeURIComponent(row.id)}`}
              className="inline-block text-[#0E78AA] font-semibold hover:underline"
            >
              فتح أمر البيع
            </Link>

            <table className={mfgTableClass}>
              <thead className={mfgTheadClass}>
                <tr>
                  <th className={mfgThClass}>الصنف</th>
                  <th className={mfgThClass}>المخزن</th>
                  <th className={mfgThClass}>الكمية المطلوبة</th>
                  <th className={mfgThClass}>المتاح (رصيد المخزن)</th>
                  <th className={mfgThClass}>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {row.lines.map((l, i) => (
                  <tr key={i} className={mfgTrClass}>
                    <td className={mfgTdClass}>
                      {l.itemName}
                      {l.itemSerial ? ` (${l.itemSerial})` : ''}
                    </td>
                    <td className={mfgTdClass}>{l.warehouseName || '—'}</td>
                    <td className={`${mfgTdClass} tabular-nums`}>
                      {l.quantity.toLocaleString('ar-EG')}
                    </td>
                    <td className={`${mfgTdClass} tabular-nums`}>
                      {l.availableQuantity != null
                        ? l.availableQuantity.toLocaleString('ar-EG')
                        : '—'}
                    </td>
                    <td className={mfgTdClass}>{l.lineNotes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {showManufacturingDetails ? (
              row.workOrders.length === 0 ? (
                <p className="text-xs text-amber-700">لا يوجد أمر شغل مرتبط</p>
              ) : (
                row.workOrders.map((wo) => (
                  <div key={wo.id} className="rounded-xl border border-[#E6F0F7] bg-[#F8FBFD] p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#0A3D5E]">أمر شغل {wo.orderNumber}</span>
                      <StatusBadge
                        tone={workOrderStatusTone(wo.status)}
                        label={manufacturingWorkOrderStatusLabel(wo.status)}
                      />
                      <span className="text-xs text-slate-600">
                        {wo.percentComplete.toLocaleString('ar-EG')}%
                      </span>
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
                          <th className={mfgThClass}>التنفيذ الجاري</th>
                          <th className={mfgThClass}>متبقي</th>
                          <th className={mfgThClass}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wo.bomPlans.map((p, i) => (
                          <tr key={i} className={mfgTrClass}>
                            <td className={mfgTdClass}>{p.bomName}</td>
                            <td className={`${mfgTdClass} tabular-nums`}>
                              {p.requiredQuantity.toLocaleString('ar-EG')}
                            </td>
                            <td className={`${mfgTdClass} tabular-nums`}>
                              {p.completedQuantity.toLocaleString('ar-EG')}
                            </td>
                            <td className={`${mfgTdClass} tabular-nums text-[#0E78AA]`}>
                              {p.inProgressQuantity.toLocaleString('ar-EG')}
                            </td>
                            <td className={`${mfgTdClass} tabular-nums`}>
                              {p.remainingQuantity.toLocaleString('ar-EG')}
                            </td>
                            <td className={`${mfgTdClass} tabular-nums`}>
                              {p.percentComplete.toLocaleString('ar-EG')}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )
            ) : null}
          </div>
        </MfgTableCard>
      ))}
    </div>
  );
}
