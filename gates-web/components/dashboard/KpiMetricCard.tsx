'use client';

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASHBOARD_CARD_CLASS } from './chrome';

export type KpiAccent = 'sky' | 'teal' | 'emerald' | 'amber' | 'rose' | 'violet' | 'indigo';

export type KpiMetricCardProps = {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  trend?: ReactNode;
  trendTone?: 'up' | 'down' | 'neutral';
  icon?: LucideIcon;
  accent?: KpiAccent;
  highlight?: boolean;
  className?: string;
};

const KPI_ACCENTS: Record<KpiAccent, { icon: string; bar: string }> = {
  sky: { icon: 'bg-[#0E79AA]/8 text-[#0E79AA]', bar: 'border-t-[#0E79AA]' },
  teal: { icon: 'bg-sky-50 text-sky-700', bar: 'border-t-sky-500' },
  emerald: { icon: 'bg-emerald-50/80 text-emerald-700', bar: 'border-t-emerald-500' },
  amber: { icon: 'bg-amber-50/80 text-amber-700', bar: 'border-t-amber-500' },
  rose: { icon: 'bg-rose-50/80 text-rose-700', bar: 'border-t-rose-500' },
  violet: { icon: 'bg-[#0E79AA]/8 text-[#0E79AA]', bar: 'border-t-[#0E79AA]' },
  indigo: { icon: 'bg-sky-50/80 text-sky-700', bar: 'border-t-sky-500' },
};

const AUTO_ACCENTS: KpiAccent[] = ['sky', 'emerald', 'amber', 'teal'];

const trendClass = {
  up: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60',
  down: 'bg-rose-50/80 text-rose-700 border-rose-200/60',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200/60',
} as const;

const TrendIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus,
};

export function KpiMetricCard({
  label,
  value,
  subtitle,
  trend,
  trendTone = 'neutral',
  icon: Icon,
  accent = 'sky',
  highlight,
  className,
}: KpiMetricCardProps) {
  const tone = KPI_ACCENTS[accent];
  const Arrow = TrendIcon[trendTone];
  return (
    <article
      className={cn(
        DASHBOARD_CARD_CLASS,
        'relative overflow-hidden border-t-2 p-4',
        highlight || accent === 'sky' ? tone.bar : 'border-t-transparent',
        className
      )}
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-slate-500">{label}</p>
        {Icon ? (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-2', tone.icon)}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums lg:text-3xl dark:text-slate-100">
        {value}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
              trendClass[trendTone]
            )}
          >
            <Arrow className="h-3 w-3" aria-hidden />
            {trend}
          </span>
        ) : null}
        {subtitle ? <p className="text-[11px] text-slate-500">{subtitle}</p> : null}
      </div>
    </article>
  );
}

export function KpiMetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 grid grid-cols-2 gap-5 lg:grid-cols-4', className)} dir="rtl">
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<KpiMetricCardProps>;
        if (el.props.accent) return child;
        return cloneElement(el, { accent: AUTO_ACCENTS[index % AUTO_ACCENTS.length], highlight: index === 0 });
      })}
    </div>
  );
}
