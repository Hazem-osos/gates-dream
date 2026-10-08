'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';

type RechartsModule = typeof import('recharts');

type ChartBucket = { key: string; label: string; value: number; color: string };

type ReportSummary = {
  total: number;
  overdue: number;
  dueWithin7Days: number;
  withoutWorkOrder: number;
  completed: number;
  onTrack: number;
  withAlerts: number;
  avgProgress: number;
  totalRequired: number;
  totalCompleted: number;
  totalRemaining: number;
  periodFrom: string | null;
  periodTo: string | null;
  chartBuckets: ChartBucket[];
  progressLeaders: Array<{
    id: string;
    label: string;
    percentComplete: number;
    remainingTotal: number;
  }>;
};

type ReportRow = {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  daysUntilDue: number | null;
  isOverdue: boolean;
  customerName: string;
  percentComplete: number;
  requiredTotal: number;
  completedTotal: number;
  remainingTotal: number;
  workOrderCount: number;
  productionOrderCount: number;
  statusBucket: string;
  alerts: string[];
  lines: Array<{ itemName: string; quantity: number }>;
  workOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    percentComplete: number;
    remainingTotal: number;
    requiredTotal: number;
    completedTotal: number;
    bomPlans: Array<{
      bomName: string;
      requiredQuantity: number;
      completedQuantity: number;
      remainingQuantity: number;
      percentComplete: number;
    }>;
    finishedLines: Array<{
      itemName: string;
      plannedQuantity: number;
      completedQuantity: number;
    }>;
    productionOrders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      materialsPosted: boolean;
    }>;
    alerts: string[];
  }>;
};

const BUCKET_LABEL: Record<string, string> = {
  withoutWorkOrder: 'بدون أمر شغل',
  overdue: 'متأخر',
  dueSoon: 'تسليم قريب',
  completed: 'مكتمل',
  onTrack: 'على المسار',
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

function useRecharts() {
  const [mod, setMod] = useState<RechartsModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import('recharts').then((loaded) => {
      if (!cancelled) setMod(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return mod;
}

function CommitmentsCharts({ summary }: { summary: ReportSummary }) {
  const R = useRecharts();
  const pieRows = summary.chartBuckets.filter((b) => b.value > 0);
  const barRows = summary.progressLeaders.map((r) => ({
    name: r.label,
    percent: r.percentComplete,
  }));

  if (!R) {
    return <div className="h-52 animate-pulse rounded-2xl bg-[#EAF6FB]" />;
  }

  const { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  const tip = { borderRadius: 12, border: '1px solid #D6EAF3', fontSize: 12 };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm">
        <h4 className="mb-2 text-sm font-bold text-[#0A3D5E]">توزيع أوامر البيع حسب الموقف</h4>
        {pieRows.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">لا توجد بيانات للرسم</p>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieRows}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={42}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {pieRows.map((seg) => (
                    <Cell key={seg.key} fill={seg.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {summary.chartBuckets.map((b) => (
            <li key={b.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
              {b.label}: {b.value}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm">
        <h4 className="mb-2 text-sm font-bold text-[#0A3D5E]">نسب الإنجاز — أعلى أوامر البيع</h4>
        {barRows.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">لا توجد بيانات</p>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barRows} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#4B6472' }}
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" width={32} />
                <Tooltip contentStyle={tip} formatter={(v) => [`${Number(v)}%`, 'إنجاز']} />
                <Bar dataKey="percent" fill="#0E78AA" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export function ManufacturingProductionCommitmentsResults({
  query,
}: {
  query: Record<string, string>;
}) {
  const { data: response, isLoading, isError } = useApiQuery<ReportRow[]>(
    ['mfg-production-commitments', query],
    '/manufacturing/reports/production-commitments',
    query
  );

  const rows = response?.data ?? [];
  const summary = response?.summary as ReportSummary | undefined;

  const periodLabel = useMemo(() => {
    const from = summary?.periodFrom ?? query.fromDate;
    const to = summary?.periodTo ?? query.toDate;
    if (from && to) return `من ${formatDate(from)} إلى ${formatDate(to)} (تاريخ أمر البيع)`;
    if (from) return `من ${formatDate(from)}`;
    if (to) return `حتى ${formatDate(to)}`;
    return 'كل الفترات — تاريخ أمر البيع';
  }, [summary, query.fromDate, query.toDate]);

  if (isLoading) return <p className="text-sm text-slate-500">جاري تحميل التقرير…</p>;
  if (isError) return <p className="text-sm text-rose-600">تعذر تحميل التقرير</p>;

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-500">{periodLabel}</p>
        <p className="text-sm text-slate-500">لا توجد أوامر بيع ضمن المرشحات.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-[#D6EAF3] bg-[#F8FBFD] px-4 py-2 text-xs text-slate-600">
        {periodLabel}
        {query.invoiceNumber ? (
          <span className="ms-2 font-semibold text-[#0A3D5E]">
            · بحث: {query.invoiceNumber}
          </span>
        ) : null}
      </p>

      {summary ? (
        <>
          <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            <div className="min-w-[9.5rem] shrink-0">
              <MfgMetric label="أوامر البيع" value={summary.total} />
            </div>
            <div className="min-w-[9.5rem] shrink-0">
              <MfgMetric
                label="متوسط الإنجاز"
                value={`${summary.avgProgress.toLocaleString('ar-EG')}%`}
                tone="ok"
              />
            </div>
            <div className="min-w-[9.5rem] shrink-0">
              <MfgMetric label="متأخر التسليم" value={summary.overdue} tone="warn" />
            </div>
            <div className="min-w-[9.5rem] shrink-0">
              <MfgMetric label="تسليم ≤ 7 أيام" value={summary.dueWithin7Days} tone="warn" />
            </div>
            <div className="min-w-[9.5rem] shrink-0">
              <MfgMetric label="بدون أمر شغل" value={summary.withoutWorkOrder} tone="warn" />
            </div>
            <div className="min-w-[9.5rem] shrink-0">
              <MfgMetric label="على المسار" value={summary.onTrack} />
            </div>
            <div className="min-w-[9.5rem] shrink-0">
              <MfgMetric label="مكتمل تصنيعاً" value={summary.completed} tone="ok" />
            </div>
            <div className="min-w-[9.5rem] shrink-0">
              <MfgMetric label="تحتاج متابعة" value={summary.withAlerts} tone="bad" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MfgMetric
              label="كمية مطلوبة (تخطيط)"
              value={summary.totalRequired.toLocaleString('ar-EG')}
              hint="مجموع أوامر الشغل"
            />
            <MfgMetric
              label="منفّذ"
              value={summary.totalCompleted.toLocaleString('ar-EG')}
              tone="ok"
            />
            <MfgMetric
              label="متبقي"
              value={summary.totalRemaining.toLocaleString('ar-EG')}
              tone="warn"
            />
          </div>

          <CommitmentsCharts summary={summary} />
        </>
      ) : null}

      <MfgTableCard title="ملخص سريع" scrollViewport>
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>أمر البيع</th>
              <th className={mfgThClass}>العميل</th>
              <th className={mfgThClass}>تاريخ الأمر</th>
              <th className={mfgThClass}>التسليم</th>
              <th className={mfgThClass}>إنجاز</th>
              <th className={mfgThClass}>الموقف</th>
              <th className={mfgThClass}>شغل / تصنيع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={mfgTrClass}>
                <td className={mfgTdClass}>
                  <Link
                    href={`/manufacturing/operations/sales-order?orderId=${encodeURIComponent(row.id)}`}
                    className="font-semibold text-[#0E78AA] hover:underline"
                  >
                    {row.invoiceNumber || '—'}
                  </Link>
                </td>
                <td className={mfgTdClass}>{row.customerName || '—'}</td>
                <td className={mfgTdClass}>{formatDate(row.date)}</td>
                <td className={mfgTdClass}>
                  {row.dueDate ? (
                    <span className={row.isOverdue ? 'font-semibold text-rose-600' : ''}>
                      {formatDate(row.dueDate)}
                      {row.daysUntilDue != null && row.percentComplete < 100
                        ? row.daysUntilDue < 0
                          ? ` (−${Math.abs(row.daysUntilDue)} ي)`
                          : ` (+${row.daysUntilDue} ي)`
                        : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={mfgTdClass}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-[#E6F0F7]">
                      <div
                        className="h-full rounded-full bg-[#0E78AA]"
                        style={{ width: `${Math.min(100, row.percentComplete)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums">
                      {row.percentComplete.toLocaleString('ar-EG')}%
                    </span>
                  </div>
                </td>
                <td className={mfgTdClass}>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      row.statusBucket === 'overdue' && 'bg-rose-100 text-rose-800',
                      row.statusBucket === 'dueSoon' && 'bg-amber-100 text-amber-900',
                      row.statusBucket === 'withoutWorkOrder' && 'bg-orange-100 text-orange-900',
                      row.statusBucket === 'completed' && 'bg-emerald-100 text-emerald-800',
                      row.statusBucket === 'onTrack' && 'bg-sky-100 text-sky-900'
                    )}
                  >
                    {BUCKET_LABEL[row.statusBucket] ?? row.statusBucket}
                  </span>
                </td>
                <td className={mfgTdClass}>
                  <span className="text-xs text-slate-600">
                    {row.workOrderCount} شغل · {row.productionOrderCount} تصنيع
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </MfgTableCard>

      {rows.map((row) => (
        <MfgTableCard
          key={row.id}
          title={`تفاصيل — أمر بيع ${row.invoiceNumber || '—'}`}
          toolbar={
            <span className="text-xs font-semibold text-[#0A3D5E]">
              إنجاز: {row.percentComplete.toLocaleString('ar-EG')}% · متبقي{' '}
              {row.remainingTotal.toLocaleString('ar-EG')}
            </span>
          }
        >
          <div className="space-y-3 p-4 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
              <span>العميل: {row.customerName || '—'}</span>
              <span>تاريخ الأمر: {formatDate(row.date)}</span>
              {row.dueDate ? (
                <span className={row.isOverdue ? 'font-semibold text-rose-600' : ''}>
                  التسليم: {formatDate(row.dueDate)}
                </span>
              ) : null}
            </div>

            {row.alerts.length > 0 ? (
              <ul className="list-disc space-y-1 ps-5 text-xs text-rose-700">
                {row.alerts.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : null}

            <table className={mfgTableClass}>
              <thead className={mfgTheadClass}>
                <tr>
                  <th className={mfgThClass}>المنتج (أمر البيع)</th>
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
              <p className="text-xs text-amber-700">لم يُنشأ أمر شغل بعد.</p>
            ) : (
              row.workOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="rounded-xl border border-[#D6EAF3] bg-[#F8FBFD] p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#0A3D5E]">أمر شغل {wo.orderNumber}</span>
                    <StatusBadge
                      label={manufacturingWorkOrderStatusLabel(wo.status)}
                      tone={workOrderStatusTone(wo.status)}
                    />
                    <span className="text-xs text-slate-600">
                      {wo.percentComplete.toLocaleString('ar-EG')}% · مطلوب{' '}
                      {wo.requiredTotal.toLocaleString('ar-EG')} · منفّذ{' '}
                      {wo.completedTotal.toLocaleString('ar-EG')}
                    </span>
                    <Link
                      href={`/manufacturing/operations/production-planning?id=${encodeURIComponent(wo.id)}`}
                      className="text-xs text-[#0E78AA] hover:underline"
                    >
                      فتح
                    </Link>
                  </div>

                  {wo.bomPlans.length > 0 ? (
                    <table className={cn(mfgTableClass, 'mb-2')}>
                      <thead className={mfgTheadClass}>
                        <tr>
                          <th className={mfgThClass}>نموذج التصنيع</th>
                          <th className={mfgThClass}>مطلوب</th>
                          <th className={mfgThClass}>منفّذ</th>
                          <th className={mfgThClass}>متبقي</th>
                          <th className={mfgThClass}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wo.bomPlans.map((bp, i) => (
                          <tr key={i} className={mfgTrClass}>
                            <td className={mfgTdClass}>{bp.bomName}</td>
                            <td className={mfgTdClass}>
                              {bp.requiredQuantity.toLocaleString('ar-EG')}
                            </td>
                            <td className={mfgTdClass}>
                              {bp.completedQuantity.toLocaleString('ar-EG')}
                            </td>
                            <td className={mfgTdClass}>
                              {bp.remainingQuantity.toLocaleString('ar-EG')}
                            </td>
                            <td className={mfgTdClass}>
                              {bp.percentComplete.toLocaleString('ar-EG')}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}

                  <table className={mfgTableClass}>
                    <thead className={mfgTheadClass}>
                      <tr>
                        <th className={mfgThClass}>المنتج النهائي</th>
                        <th className={mfgThClass}>مطلوب</th>
                        <th className={mfgThClass}>منجز</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wo.finishedLines.map((fl, i) => (
                        <tr key={i} className={mfgTrClass}>
                          <td className={mfgTdClass}>{fl.itemName}</td>
                          <td className={mfgTdClass}>
                            {fl.plannedQuantity.toLocaleString('ar-EG')}
                          </td>
                          <td className={mfgTdClass}>
                            {fl.completedQuantity.toLocaleString('ar-EG')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {wo.productionOrders.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-600">
                      أوامر تصنيع:{' '}
                      {wo.productionOrders.map((po) => (
                        <Link
                          key={po.id}
                          href={`/manufacturing/operations/operation?orderId=${encodeURIComponent(po.id)}`}
                          className="me-2 text-[#0E78AA] hover:underline"
                        >
                          {po.orderNumber}
                          {!po.materialsPosted ? ' (بدون ترحيل مواد)' : ''}
                        </Link>
                      ))}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </MfgTableCard>
      ))}
    </div>
  );
}
