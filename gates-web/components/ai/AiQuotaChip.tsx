'use client';

import { useApiQuery } from '@/lib/hooks/useApi';

type Quota = { used: number; limit: number; remaining: number; resetAt: string };

export function AiQuotaChip() {
  const { data } = useApiQuery<Quota>(['ai-quota'], '/ai/quota');
  const quota = data?.data;
  if (!quota) return null;
  const pct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const tone = pct >= 95 ? 'text-rose-200' : pct >= 80 ? 'text-amber-200' : 'text-slate-300';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[10px] ring-1 ring-white/10 ${tone}`}>
      رصيد الذكاء: {quota.used.toLocaleString('ar-EG')} / {quota.limit.toLocaleString('ar-EG')}
    </span>
  );
}
