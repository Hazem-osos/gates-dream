'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type KpiTrendTone = 'up' | 'down' | 'neutral';

export type KpiSummaryCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: ReactNode;
  trendTone?: KpiTrendTone;
  icon?: LucideIcon;
  className?: string;
};

const trendToneClass: Record<KpiTrendTone, string> = {
  up: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  down: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function KpiSummaryCard({
  label,
  value,
  hint,
  trend,
  trendTone = 'neutral',
  icon: Icon,
  className,
}: KpiSummaryCardProps) {
  return (
    <article
      className={cn(
        'rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className
      )}
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">{label}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0E79AA0D] text-[#0E79AA]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
      </div>
      {trend ? (
        <span
          className={cn(
            'mt-3 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
            trendToneClass[trendTone]
          )}
        >
          {trend}
        </span>
      ) : null}
    </article>
  );
}

export function ModuleKpiGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4', className)} dir="rtl">
      {children}
    </div>
  );
}
