'use client';

import { cn } from '@/lib/utils';
import { formatMoneyAr } from '@/lib/formatMoney';
import { ModuleCharts } from './ModuleCharts';
import { DASH_NUM } from './tokens';

export function SegmentedBar({
  segments,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <ModuleCharts segments={segments} />
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            {seg.label}
            <span className={cn(DASH_NUM, 'text-slate-700')}>{formatMoneyAr(seg.value)}</span>
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
          className={cn('h-full', pct >= 100 ? 'bg-emerald-600' : pct >= 70 ? 'bg-[#0E78AA]' : 'bg-amber-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
