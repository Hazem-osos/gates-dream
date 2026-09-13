'use client';

import Link from 'next/link';
import { Bell, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/components/ui/StatusBadge';
import { DashboardEmptyState } from '@/components/dashboard-primitives/DashboardEmptyState';
import { StatusDotPill } from '@/components/dashboard-primitives/StatusDotPill';
import { DASHBOARD_CARD_CLASS } from './chrome';
import type { AttentionItem } from './types';

const STRIPE: Record<StatusTone, string> = {
  danger: 'bg-rose-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  info: 'bg-[#0E79AA]',
  purple: 'bg-violet-500',
  neutral: 'bg-slate-300',
};

const PILL: Record<StatusTone, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  danger: 'danger',
  warning: 'warning',
  success: 'success',
  info: 'info',
  purple: 'info',
  neutral: 'neutral',
};

export function AttentionQueueCard({
  title = 'صندوق المعلقات والتنبيهات',
  items,
  loading,
  className,
}: {
  title?: string;
  items: AttentionItem[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <section className={cn(DASHBOARD_CARD_CLASS, 'overflow-hidden', className)} dir="rtl">
      <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50/80 text-amber-700">
          <Bell className="h-4 w-4" aria-hidden />
        </span>
        {title}
      </h2>
      {loading ? (
        <div className="m-4 h-28 animate-pulse rounded-lg bg-slate-100" />
      ) : items.length === 0 ? (
        <DashboardEmptyState title="لا توجد عناصر تحتاج إجراء الآن" description="عندما يظهر مستند معلّق سيظهر هنا مباشرة." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const tone = (item.tone ?? 'info') as StatusTone;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80"
                >
                  <span className={cn('absolute inset-y-0 right-0 w-[3px]', STRIPE[tone])} aria-hidden />
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    {item.detail ? <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p> : null}
                  </div>
                  <StatusDotPill
                    label={item.count != null ? String(item.count) : 'متابعة'}
                    tone={PILL[tone]}
                  />
                  <span className="mt-0.5 inline-flex translate-x-1 items-center gap-0.5 text-[11px] font-semibold text-[#0E79AA] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                    عرض المستند
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
