'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useApiQuery } from '@/lib/hooks/useApi';
import {
  MfgMetric,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgTdNum,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { SegmentedBar } from '@/components/dashboard-primitives';
import { StatusBadge } from '@/components/ui';
import { formatMoneyAr } from '@/lib/formatMoney';
import { cn } from '@/lib/utils';

type RechartsModule = typeof import('recharts');

type ChartBucket = { key: string; label: string; value: number; color: string };

type ReportSummary = {
  orderCount: number;
  materialsPostedTotal: number;
  laborPostedTotal: number;
  overheadPostedTotal: number;
  additionalTotal: number;
  completionTotal: number;
  wipBalanceTotal: number;
  totalCostEstimate: number;
  withoutMaterialsPosting: number;
  inProgressCount: number;
  completedCount: number;
  releasedCount: number;
  unifiedPostingCount: number;
  withAlertsCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  chartBuckets: ChartBucket[];
  costComposition: ChartBucket[];
  topCostOrders: Array<{
    id: string;
    orderNumber: string;
    label: string;
    totalCost: number;
    statusLabel: string;
  }>;
};

type JeRef = { id: string; serial: string } | null;

type ReportRow = {
  id: string;
  orderNumber: string;
  statusLabel: string;
  bomName: string;
  finishedItemName: string;
  workOrderNumber: string;
  warehouseRawName: string;
  warehouseFinishedName: string;
  costCenter: string;
  plannedQuantity: number;
  actualQuantity: number | null;
  unitCost: number | null;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  additionalCost: number;
  totalCostEstimate: number;
  completionValue: number;
  wipBalance: number;
  postingMode: 'unified' | 'standard';
  postingModeLabel: string;
  materialsPosted: boolean;
  laborPosted: boolean;
  completionPosted: boolean;
  additionalPosted: boolean;
  postingAlerts: string[];
  releasedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  journals: {
    materialsIssue: JeRef;
    laborOverhead: JeRef;
    completion: JeRef;
    additionalCosts: JeRef;
  };
};

function formatDate(iso: string | null) {
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

function PostingDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        ok ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
      )}
      title={label}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', ok ? 'bg-emerald-500' : 'bg-slate-300')} />
      {label}
    </span>
  );
}

function JeLink({ je, label }: { je: JeRef; label: string }) {
  if (!je) return <span className="text-slate-400">—</span>;
  return (
    <Link
      href={`/accounting/operations/journal-entry?id=${encodeURIComponent(je.id)}`}
      className="text-[#0E78AA] hover:underline"
      title={je.id}
    >
      {label}: {je.serial}
    </Link>
  );
}

function CostPostingCharts({ summary }: { summary: ReportSummary }) {
  const R = useRecharts();
  const pieRows = summary.chartBuckets.filter((b) => b.value > 0);
  const barRows = summary.topCostOrders.map((r) => ({
    name: r.orderNumber,
    cost: r.totalCost,
    id: r.id,
  }));

  if (!R) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[#EAF6FB]" />;
  }

  const { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  const tip = { borderRadius: 12, border: '1px solid #D6EAF3', fontSize: 12 };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm">
        <h4 className="mb-2 text-sm font-bold text-[#0A3D5E]">موقف أوامر التصنيع</h4>
        {pieRows.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">لا توجد بيانات للرسم</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieRows}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={40}
                  outerRadius={68}
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
        <h4 className="mb-2 text-sm font-bold text-[#0A3D5E]">أعلى تكاليف تقديرية (أوامر)</h4>
        {barRows.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">لا توجد بيانات</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barRows} margin={{ top: 8, right: 8, left: 4, bottom: 28 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#4B6472' }}
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => formatMoneyAr(Number(v))} />
                <Tooltip
                  contentStyle={tip}
                  formatter={(v) => [formatMoneyAr(Number(v)), 'تكلفة']}
                />
                <Bar dataKey="cost" fill="#0E78AA" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <ul className="mt-2 space-y-0.5 text-[10px] text-slate-500">
          {summary.topCostOrders.slice(0, 4).map((r) => (
            <li key={r.id}>
              <Link
                href={`/manufacturing/operations/operation?id=${encodeURIComponent(r.id)}`}
                className="text-[#0E78AA] hover:underline"
              >
                {r.orderNumber}
              </Link>
              {' — '}
              {r.label} · {r.statusLabel}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RowDetail({ row }: { row: ReportRow }) {
  return (
    <div className="grid gap-3 border-t border-[#E8F4F8] bg-[#F8FBFD] px-4 py-3 text-xs text-slate-700 md:grid-cols-2">
      <div className="space-y-1">
        <p className="font-semibold text-[#0A3D5E]">المخازن والكميات</p>
        <p>خامات: {row.warehouseRawName || '—'}</p>
        <p>منتج تام: {row.warehouseFinishedName || '—'}</p>
        <p>
          مخطط / فعلي: {row.plannedQuantity}
          {row.actualQuantity != null ? ` / ${row.actualQuantity}` : ' / —'}
        </p>
        {row.unitCost != null ? <p>تكلفة الوحدة: {formatMoneyAr(row.unitCost)}</p> : null}
        <p>نمط الترحيل: {row.postingModeLabel}</p>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-[#0A3D5E]">التواريخ</p>
        <p>إنشاء: {formatDate(row.createdAt)}</p>
        <p>تأكيد: {formatDate(row.releasedAt)}</p>
        <p>إتمام: {formatDate(row.completedAt)}</p>
      </div>
      <div className="space-y-1 md:col-span-2">
        <p className="font-semibold text-[#0A3D5E]">قيود محاسبية</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <JeLink je={row.journals.materialsIssue} label="صرف خامات" />
          <JeLink je={row.journals.additionalCosts} label="صرف موحّد / إضافي" />
          <JeLink je={row.journals.laborOverhead} label="أجور ومصاريف" />
          <JeLink je={row.journals.completion} label="إتمام" />
        </div>
      </div>
      {row.postingAlerts.length > 0 ? (
        <div className="md:col-span-2">
          <p className="mb-1 font-semibold text-amber-800">ملاحظات ترحيل</p>
          <ul className="list-disc ps-4 text-amber-900">
            {row.postingAlerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ManufacturingCostPostingSummaryResults({
  query,
}: {
  query: Record<string, string>;
}) {
  const { data: response, isLoading, isError } = useApiQuery<ReportRow[]>(
    ['mfg-cost-posting-summary', query],
    '/manufacturing/reports/cost-posting-summary',
    query
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = response?.data ?? [];
  const summary = response?.summary as ReportSummary | undefined;

  const periodLabel = useMemo(() => {
    const from = summary?.periodFrom ?? query.fromDate;
    const to = summary?.periodTo ?? query.toDate;
    if (from && to) return `من ${formatDate(from)} إلى ${formatDate(to)}`;
    if (from) return `من ${formatDate(from)}`;
    if (to) return `حتى ${formatDate(to)}`;
    return 'كل الفترات — تاريخ إنشاء / تأكيد / إتمام';
  }, [summary, query.fromDate, query.toDate]);

  const alertRows = useMemo(
    () => rows.filter((r) => r.postingAlerts.length > 0).slice(0, 6),
    [rows]
  );

  if (isLoading) return <p className="text-sm text-slate-500">جاري تحميل التقرير…</p>;
  if (isError) return <p className="text-sm text-rose-600">تعذر تحميل التقرير</p>;

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-500">{periodLabel}</p>
        <p className="text-sm text-slate-500">لا توجد أوامر تصنيع ضمن المرشحات.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-[#D6EAF3] bg-[#F8FBFD] px-4 py-2 text-xs text-slate-600">
        {periodLabel}
        {query.postedOnly === 'true' ? (
          <span className="ms-2 font-semibold text-[#0A3D5E]">· أوامر بها ترحيل فقط</span>
        ) : null}
      </p>

      {summary ? (
        <>
          <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            <div className="min-w-[7rem] shrink-0">
              <MfgMetric label="أوامر" value={summary.orderCount} />
            </div>
            <div className="min-w-[9rem] shrink-0">
              <MfgMetric
                label="إجمالي تكلفة تقديرية"
                value={formatMoneyAr(summary.totalCostEstimate)}
              />
            </div>
            <div className="min-w-[8rem] shrink-0">
              <MfgMetric
                label="قيمة الإتمام"
                value={formatMoneyAr(summary.completionTotal)}
                tone="ok"
              />
            </div>
            <div className="min-w-[8rem] shrink-0">
              <MfgMetric
                label="WIP تقديري"
                value={formatMoneyAr(summary.wipBalanceTotal)}
                tone="warn"
              />
            </div>
            <div className="min-w-[7rem] shrink-0">
              <MfgMetric label="قيد التنفيذ" value={summary.inProgressCount} />
            </div>
            <div className="min-w-[7rem] shrink-0">
              <MfgMetric label="ترحيل موحّد" value={summary.unifiedPostingCount} />
            </div>
            <div className="min-w-[7rem] shrink-0">
              <MfgMetric label="تحتاج متابعة" value={summary.withAlertsCount} tone="warn" />
            </div>
          </div>

          {summary.costComposition.length > 0 ? (
            <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-bold text-[#0A3D5E]">تكوين التكاليف المرحّلة والإتمام</h4>
              <SegmentedBar segments={summary.costComposition} />
            </div>
          ) : null}

          <CostPostingCharts summary={summary} />

          {alertRows.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
              <h4 className="mb-2 text-sm font-bold text-amber-900">تنبيهات ترحيل (عينة)</h4>
              <ul className="space-y-1 text-xs text-amber-950">
                {alertRows.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/manufacturing/operations/operation?id=${encodeURIComponent(r.id)}`}
                      className="font-semibold text-[#0A3D5E] hover:underline"
                    >
                      {r.orderNumber}
                    </Link>
                    : {r.postingAlerts.join(' · ')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <MfgTableCard title="تفاصيل أوامر التصنيع والترحيل" scrollViewport>
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={cn(mfgThClass, 'w-8')} />
              <th className={mfgThClass}>أمر التصنيع</th>
              <th className={mfgThClass}>الموقف</th>
              <th className={mfgThClass}>الصنف / النموذج</th>
              <th className={mfgThClass}>مركز تكلفة</th>
              <th className={mfgThClass}>إجمالي</th>
              <th className={mfgThClass}>إتمام</th>
              <th className={mfgThClass}>WIP</th>
              <th className={mfgThClass}>ترحيل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const open = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className={mfgTrClass}>
                    <td className={mfgTdClass}>
                      <button
                        type="button"
                        className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                        onClick={() => setExpandedId(open ? null : row.id)}
                        aria-expanded={open}
                      >
                        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className={mfgTdClass}>
                      <Link
                        href={`/manufacturing/operations/operation?id=${encodeURIComponent(row.id)}`}
                        className="font-semibold text-[#0E78AA] hover:underline"
                      >
                        {row.orderNumber}
                      </Link>
                      {row.workOrderNumber ? (
                        <span className="block text-xs text-slate-500">شغل {row.workOrderNumber}</span>
                      ) : null}
                    </td>
                    <td className={mfgTdClass}>
                      <StatusBadge label={row.statusLabel} tone="neutral" compact />
                    </td>
                    <td className={mfgTdClass}>
                      <span className="block">{row.finishedItemName || '—'}</span>
                      <span className="text-xs text-slate-500">{row.bomName}</span>
                    </td>
                    <td className={mfgTdClass}>{row.costCenter || '—'}</td>
                    <td className={mfgTdNum}>{formatMoneyAr(row.totalCostEstimate)}</td>
                    <td className={mfgTdNum}>
                      {row.completionPosted ? formatMoneyAr(row.completionValue) : '—'}
                    </td>
                    <td className={mfgTdNum}>
                      {row.wipBalance > 0 ? formatMoneyAr(row.wipBalance) : '—'}
                    </td>
                    <td className={cn(mfgTdClass, 'min-w-[11rem]')}>
                      <div className="flex flex-wrap gap-1">
                        <PostingDot ok={row.materialsPosted} label="مواد" />
                        <PostingDot ok={row.laborPosted} label="تكاليف" />
                        <PostingDot ok={row.completionPosted} label="إتمام" />
                        {row.postingMode === 'unified' ? (
                          <PostingDot ok={row.additionalPosted} label="موحّد" />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {open ? (
                    <tr className={mfgTrClass}>
                      <td colSpan={9} className="p-0">
                        <RowDetail row={row} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </MfgTableCard>
    </div>
  );
}
