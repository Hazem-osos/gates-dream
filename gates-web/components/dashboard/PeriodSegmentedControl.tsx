'use client';

import { cn } from '@/lib/utils';
import { DASHBOARD_PERIODS } from './period';
import type { DashboardPeriod } from './types';

export function PeriodSegmentedControl({
  value,
  onChange,
  className,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
  className?: string;
}) {
  return (
    <div
      className={cn('inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800', className)}
      role="tablist"
      aria-label="نطاق الفترة"
      dir="rtl"
    >
      {DASHBOARD_PERIODS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'h-7 rounded-md px-2.5 text-xs font-semibold transition-colors',
              active
                ? 'bg-white text-[#0E79AA] shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
