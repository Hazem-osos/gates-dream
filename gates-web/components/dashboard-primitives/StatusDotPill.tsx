'use client';

import { cn } from '@/lib/utils';

export type StatusDotTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<StatusDotTone, { wrap: string; dot: string }> = {
  success: {
    wrap: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60',
    dot: 'bg-emerald-500',
  },
  warning: {
    wrap: 'bg-amber-50/80 text-amber-700 border-amber-200/60',
    dot: 'bg-amber-500',
  },
  danger: {
    wrap: 'bg-rose-50/80 text-rose-700 border-rose-200/60',
    dot: 'bg-rose-500',
  },
  info: {
    wrap: 'bg-sky-50/80 text-sky-700 border-sky-200/60',
    dot: 'bg-sky-500',
  },
  neutral: {
    wrap: 'bg-slate-50 text-slate-600 border-slate-200/60',
    dot: 'bg-slate-400',
  },
};

export function StatusDotPill({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: StatusDotTone;
  className?: string;
}) {
  const style = TONE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        style.wrap,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden />
      {label}
    </span>
  );
}
