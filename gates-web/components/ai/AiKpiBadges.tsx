'use client';

import type { AiKpiItem } from '@/lib/ai/types';

export function AiKpiBadges({ items }: { items: AiKpiItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-2.5 py-1.5"
        >
          <p className="text-[10px] font-medium leading-4 text-slate-500">{item.label}</p>
          <p className="text-sm font-bold tabular-nums leading-5 text-[#0E79AA]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
