'use client';

import { cn } from '@/lib/utils';
import { formatMoneyAr } from '@/lib/formatMoney';

export type CostRollupSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type CostRollupCardProps = {
  title?: string;
  slices: CostRollupSlice[];
  className?: string;
};

export function CostRollupCard({
  title = 'تحليل تكلفة الإنتاج',
  slices,
  className,
}: CostRollupCardProps) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);

  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900',
        className
      )}
      dir="rtl"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-sm font-bold tabular-nums text-[#0E79AA]">{formatMoneyAr(total)}</p>
      </div>
      <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {slices.map((slice) => {
          const pct = total > 0 ? (Math.max(0, slice.value) / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <span
              key={slice.id}
              className="h-full"
              style={{ width: `${pct}%`, backgroundColor: slice.color }}
              title={`${slice.label} ${pct.toFixed(1)}٪`}
            />
          );
        })}
      </div>
      <ul className="space-y-2">
        {slices.map((slice) => {
          const pct = total > 0 ? (Math.max(0, slice.value) / total) * 100 : 0;
          return (
            <li key={slice.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                {slice.label}
              </span>
              <span className="tabular-nums font-semibold text-slate-900">
                {formatMoneyAr(slice.value)}
                <span className="ms-2 text-slate-400">{pct.toFixed(0)}٪</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
