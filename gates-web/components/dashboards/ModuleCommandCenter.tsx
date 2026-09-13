'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCardsSkeleton, TableSkeleton } from '@/components/ui/skeletons';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import { formatDateAr, formatEgp } from '@/lib/subcontracts/money';
import type { DashboardActivityItem, DashboardInboxItem, DashboardTone } from '@/lib/dashboards/types';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<DashboardTone, string> = {
  red: 'border-red-200 bg-red-50 text-red-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  blue: 'border-[#D6EAF3] bg-[#F0F7FB] text-[#094C6B]',
};

const TONE_DOT: Record<DashboardTone, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  blue: 'bg-[#0E79AA]',
};

const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  SITE_SUBMITTED: 'مهندس الموقع',
  CONSULTANT_APPROVED: 'الاستشاري',
  TECH_OFFICE_APPROVED: 'المكتب الفني',
  SUBMITTED_TO_CLIENT: 'لدى المالك',
  CLIENT_APPROVED: 'معتمد من المالك',
  FINANCE_POSTED: 'مرحّل',
  PAID: 'مدفوع',
  BOUNCED_RETURNED: 'شيك مرتد',
  PENDING_CLEARANCE: 'بانتظار الإبراء',
  ACTIVE: 'نشط',
};

function statusLabel(status: string): string {
  return STATUS_AR[status] ?? status;
}

export function ModuleCommandCenter({
  title,
  description,
  asOfDate,
  branchReady,
  actions,
  kpis,
  loading,
  error,
  leftTitle,
  leftChart,
  rightTitle,
  rightChart,
  inbox,
  activity,
}: {
  title: string;
  description: string;
  asOfDate?: string;
  branchReady?: boolean;
  actions?: ReactNode;
  kpis: {
    label: string;
    value: ReactNode;
    hint?: string;
    trend?: string;
    tone?: 'default' | 'danger' | 'success';
  }[];
  loading?: boolean;
  error?: boolean;
  leftTitle: string;
  leftChart: ReactNode;
  rightTitle: string;
  rightChart: ReactNode;
  inbox: DashboardInboxItem[];
  activity: DashboardActivityItem[];
}) {
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        statusBadge={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-[#D6EAF3] bg-white px-3 py-1 text-[#094C6B]">
              {asOfDate ? `حتى ${formatDateAr(asOfDate)}` : 'الفترة الحالية'}
            </span>
            <span
              className={cn(
                'rounded-full px-3 py-1',
                branchReady ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
              )}
            >
              {branchReady ? 'الفرع النشط محمّل' : 'بانتظار سياق الفرع'}
            </span>
          </div>
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          تعذر تحميل لوحة القيادة. تحقق من اتصال الخادم وصلاحية الشركة ثم أعد المحاولة.
        </p>
      ) : null}

      {loading ? (
        <MetricCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4">
              <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
              <p
                className={cn(
                  'mt-1 text-lg font-bold tabular-nums',
                  kpi.tone === 'danger'
                    ? 'text-red-700'
                    : kpi.tone === 'success'
                      ? 'text-emerald-700'
                      : 'text-[#094C6B]'
                )}
              >
                {kpi.value}
              </p>
              {kpi.hint ? <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p> : null}
              {kpi.trend ? (
                <p
                  className={cn(
                    'mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    kpi.trend.startsWith('-')
                      ? 'bg-red-50 text-red-700'
                      : 'bg-emerald-50 text-emerald-700'
                  )}
                >
                  {kpi.trend}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[#0E79AA]">{leftTitle}</h2>
          <div className="h-72">{loading ? <TableSkeleton rows={4} columns={2} /> : leftChart}</div>
        </section>
        <section className="rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[#0E79AA]">{rightTitle}</h2>
          <div className="h-72">{loading ? <TableSkeleton rows={4} columns={2} /> : rightChart}</div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[#0E79AA]">صندوق العمليات الحرجة</h2>
          {loading ? (
            <TableSkeleton rows={4} columns={2} />
          ) : inbox.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">لا توجد عناصر عاجلة حالياً</p>
          ) : (
            <ul className="space-y-2">
              {inbox.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={cn('block rounded-xl border px-3 py-3 transition hover:shadow-sm', TONE_CLASS[item.tone])}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <span className={cn('h-2 w-2 rounded-full', TONE_DOT[item.tone])} />
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs opacity-80">{item.detail}</p>
                      </div>
                      {item.amount != null ? (
                        <span className="shrink-0 text-xs font-bold tabular-nums">
                          <SensitiveValue>{formatEgp(item.amount)}</SensitiveValue>
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[#0E79AA]">سجل العمليات والنشاطات الأخيرة</h2>
          {loading ? (
            <TableSkeleton rows={5} columns={2} />
          ) : activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">لا يوجد نشاط حديث</p>
          ) : (
            <ul className="divide-y divide-[#E6F0F7]">
              {activity.map((item) => (
                <li key={item.id} className="py-3">
                  <Link href={item.href} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E79AA] text-xs font-bold text-white">
                      {item.title.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#094C6B]">{item.title}</p>
                      <p className="truncate text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <div className="text-left">
                      <span className="rounded-full bg-[#F0F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#0E79AA]">
                        {statusLabel(item.status)}
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">{formatDateAr(item.at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
