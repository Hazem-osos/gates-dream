'use client';

import { cn } from '@/lib/utils';
import { DASH_NUM } from './tokens';

export function SegmentedBar({
  segments,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full"
            style={{
              width: `${total > 0 ? (Math.max(0, seg.value) / total) * 100 : 0}%`,
              backgroundColor: seg.color,
            }}
            title={`${seg.label} ${seg.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            {seg.label}
            <span className={cn(DASH_NUM, 'text-slate-700')}>{seg.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function GaugeBar({
  actual,
  target,
  actualLabel = 'فعلي',
  targetLabel = 'مستهدف',
}: {
  actual: number;
  target: number;
  actualLabel?: string;
  targetLabel?: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] text-slate-500">
          {actualLabel} / {targetLabel}
        </span>
        <span className={cn(DASH_NUM, 'text-xs font-semibold text-slate-900')}>{pct}٪</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full', pct >= 100 ? 'bg-emerald-600' : pct >= 70 ? 'bg-[#0E79AA]' : 'bg-amber-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
