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

type BomPlanRow = {
  bomId: string;
  bomName: string;
  requiredQuantity: number;
  completedQuantity: number;
  inProgressQuantity: number;
  remainingQuantity: number;
  percentComplete: number;
};

type ReportRow = {
  id: string;
  orderNumber: string;
  workDate: string;
  status: string;
  statusLabel: string;
  salesOrderNumber: string;
  percentComplete: number;
  requiredTotal: number;
  completedTotal: number;
  remainingTotal: number;
  bomPlans: BomPlanRow[];
  finishedLines: Array<{
    itemName: string;
    plannedQuantity: number;
    completedQuantity: number;
    lineDescription: string;
  }>;
  productionOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    bomName: string;
    plannedQuantity: number;
    actualQuantity: number | null;
  }>;
};

export function ManufacturingWorkOrderTrackingResults({
  query,
}: {
  query: Record<string, string>;
}) {
  const { data: response, isLoading, isError } = useApiQuery<ReportRow[]>(
    ['mfg-work-order-tracking', query],
    '/manufacturing/reports/work-order-tracking',
    query
  );

  const rows = response?.data ?? [];
  const summary = response?.summary as { total: number; confirmed: number; inProgress: number; completed: number } | undefined;

  if (isLoading) return <p className="text-sm text-slate-500">جاري تحميل التقرير…</p>;
  if (isError) return <p className="text-sm text-rose-600">تعذر تحميل التقرير</p>;

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MfgMetric label="أوامر الشغل" value={summary.total} />
          <MfgMetric label="تم التأكيد" value={summary.confirmed} tone="warn" />
          <MfgMetric label="قيد التنفيذ" value={summary.inProgress} />
          <MfgMetric label="منتهي" value={summary.completed} tone="ok" />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">لا توجد نتائج</p>
      ) : (
        rows.map((row) => (
          <MfgTableCard
            key={row.id}
            title={`أمر شغل ${row.orderNumber}`}
            toolbar={
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge tone={workOrderStatusTone(row.status)} label={row.statusLabel} />
                <span className="font-semibold text-[#0A3D5E]">
                  التقدم: {row.percentComplete.toLocaleString('ar-EG')}%
                </span>
                <Link
                  href={`/manufacturing/operations/production-planning?id=${encodeURIComponent(row.id)}`}
                  className="text-[#0E78AA] underline-offset-2 hover:underline"
                >
                  التخطيط
                </Link>
              </div>
            }
          >
            <div className="space-y-3 p-4 text-sm">
              <p className="text-slate-600">
                تاريخ {row.workDate}
                {row.salesOrderNumber ? ` · أمر بيع ${row.salesOrderNumber}` : ''}
                {' · '}
                منفّذ {row.completedTotal.toLocaleString('ar-EG')} / مطلوب{' '}
                {row.requiredTotal.toLocaleString('ar-EG')} · متبقي{' '}
                {row.remainingTotal.toLocaleString('ar-EG')}
              </p>
              <table className={mfgTableClass}>
                <thead className={mfgTheadClass}>
                  <tr>
                    <th className={mfgThClass}>نموذج التصنيع</th>
                    <th className={mfgThClass}>مطلوب</th>
                    <th className={mfgThClass}>منفّذ</th>
                    <th className={mfgThClass}>قيد التنفيذ</th>
                    <th className={mfgThClass}>متبقي</th>
                    <th className={mfgThClass}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {row.bomPlans.map((p) => (
                    <tr key={p.bomId} className={mfgTrClass}>
                      <td className={mfgTdClass}>{p.bomName}</td>
                      <td className={mfgTdClass}>{p.requiredQuantity.toLocaleString('ar-EG')}</td>
                      <td className={mfgTdClass}>{p.completedQuantity.toLocaleString('ar-EG')}</td>
                      <td className={mfgTdClass}>{p.inProgressQuantity.toLocaleString('ar-EG')}</td>
                      <td className={mfgTdClass}>{p.remainingQuantity.toLocaleString('ar-EG')}</td>
                      <td className={mfgTdClass}>{p.percentComplete.toLocaleString('ar-EG')}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {row.productionOrders.length > 0 ? (
                <details>
                  <summary className="cursor-pointer font-semibold text-[#0A3D5E]">
                    أوامر التصنيع ({row.productionOrders.length})
                  </summary>
                  <table className={`${mfgTableClass} mt-2`}>
                    <thead className={mfgTheadClass}>
                      <tr>
                        <th className={mfgThClass}>المسلسل</th>
                        <th className={mfgThClass}>النموذج</th>
                        <th className={mfgThClass}>الموقف</th>
                        <th className={mfgThClass}>مخطط</th>
                        <th className={mfgThClass}>فعلي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.productionOrders.map((po) => (
                        <tr key={po.id} className={mfgTrClass}>
                          <td className={mfgTdClass}>
                            <Link
                              href={`/manufacturing/operations/operation?orderId=${encodeURIComponent(po.id)}`}
                              className="text-[#0E78AA] underline-offset-2 hover:underline"
                            >
                              {po.orderNumber}
                            </Link>
                          </td>
                          <td className={mfgTdClass}>{po.bomName}</td>
                          <td className={mfgTdClass}>{po.status}</td>
                          <td className={mfgTdClass}>{po.plannedQuantity.toLocaleString('ar-EG')}</td>
                          <td className={mfgTdClass}>
                            {po.actualQuantity != null
                              ? po.actualQuantity.toLocaleString('ar-EG')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ) : null}
            </div>
          </MfgTableCard>
        ))
      )}
    </div>
  );
}
