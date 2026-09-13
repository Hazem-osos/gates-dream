'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DASH_LABEL, DASH_NUM, DASH_PANEL } from './tokens';
import { Sparkline } from './Sparkline';

export type MetricTicker = {
  id: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  spark?: number[];
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
};

const TONE = {
  ok: {
    value: 'text-emerald-700',
    bar: 'border-t-emerald-500',
    chip: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60',
  },
  warn: {
    value: 'text-amber-700',
    bar: 'border-t-amber-500',
    chip: 'bg-amber-50/80 text-amber-700 border-amber-200/60',
  },
  bad: {
    value: 'text-rose-700',
    bar: 'border-t-rose-500',
    chip: 'bg-rose-50/80 text-rose-700 border-rose-200/60',
  },
  neutral: {
    value: 'text-slate-900 dark:text-slate-100',
    bar: 'border-t-[#0E79AA]',
    chip: 'bg-slate-50 text-slate-600 border-slate-200/60',
  },
};

export function MetricBar({ items, loading }: { items: MetricTicker[]; loading?: boolean }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
      {loading && items.length === 0
        ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn(DASH_PANEL, 'h-28 animate-pulse')} />
          ))
        : items.map((m, index) => {
            const tone = TONE[m.tone ?? (index === 0 ? 'neutral' : 'neutral')];
            return (
              <article
                key={m.id}
                className={cn(DASH_PANEL, 'border-t-2 p-4', tone.bar)}
              >
                <p className={DASH_LABEL}>{m.label}</p>
                <p className={cn(DASH_NUM, 'mt-2 truncate text-2xl font-bold tracking-tight lg:text-[1.65rem]', tone.value)}>
                  {m.value}
                </p>
                <div className="mt-3 flex items-end justify-between gap-2">
                  {m.hint ? (
                    <p className={cn('min-w-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium', tone.chip)}>
                      {m.hint}
                    </p>
                  ) : (
                    <span />
                  )}
                  {m.spark && m.spark.length > 1 ? <Sparkline data={m.spark} /> : null}
                </div>
              </article>
            );
          })}
    </div>
  );
}
