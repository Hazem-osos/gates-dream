'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH_LABEL, DASH_NUM, DASH_PANEL } from './tokens';
import { DashboardEmptyState } from './DashboardEmptyState';

export type TriageAction = { label: string; onClick?: () => void; href?: string; tone?: 'default' | 'danger' };

export type TriageItem = {
  id: string;
  title: string;
  meta?: ReactNode;
  amount?: ReactNode;
  href?: string;
  tone?: 'bad' | 'warn' | 'info';
  actions?: TriageAction[];
};

const RAIL = { bad: 'bg-rose-500', warn: 'bg-amber-500', info: 'bg-[#0E79AA]' };

export function TriageQueue({
  title,
  items,
  loading,
  empty = 'لا توجد معلقات',
  emptyActionHref,
  emptyActionLabel,
}: {
  title: string;
  items: TriageItem[];
  loading?: boolean;
  empty?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
}) {
  return (
    <section className={cn(DASH_PANEL, 'flex min-h-0 flex-col overflow-hidden')}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className={cn(DASH_NUM, DASH_LABEL)}>{items.length}</span>
      </div>
      <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-auto">
        {loading ? (
          <li className="px-4 py-8 text-center text-xs text-slate-400">جاري التحميل…</li>
        ) : items.length === 0 ? (
          <li>
            <DashboardEmptyState
              title={empty}
              description="لا يوجد عمل معلّق في هذا الصندوق حالياً."
              actionHref={emptyActionHref}
              actionLabel={emptyActionLabel}
            />
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <div className="group relative flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50/80">
                <span className={cn('absolute inset-y-0 right-0 w-[3px]', RAIL[item.tone ?? 'info'])} aria-hidden />
                <div className="min-w-0 flex-1 pr-1">
                  {item.href ? (
                    <Link href={item.href} className="block truncate text-sm font-semibold text-slate-800 hover:text-[#0E79AA]">
                      {item.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                  )}
                  {item.meta ? <p className="mt-0.5 truncate text-xs text-slate-500">{item.meta}</p> : null}
                </div>
                {item.amount ? (
                  <div className={cn(DASH_NUM, 'text-xs font-semibold text-slate-900')}>{item.amount}</div>
                ) : null}
                {item.actions?.length ? (
                  <div className="flex shrink-0 gap-1">
                    {item.actions.map((a) =>
                      a.href ? (
                        <Link
                          key={a.label}
                          href={a.href}
                          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-white"
                        >
                          {a.label}
                        </Link>
                      ) : (
                        <button
                          key={a.label}
                          type="button"
                          onClick={a.onClick}
                          className={cn(
                            'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                            a.tone === 'danger'
                              ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              : 'border-slate-200 text-slate-600 hover:bg-white'
                          )}
                        >
                          {a.label}
                        </button>
                      )
                    )}
                  </div>
                ) : item.href ? (
                  <span className="mt-0.5 inline-flex translate-x-1 items-center gap-0.5 text-[11px] font-semibold text-[#0E79AA] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                    عرض المستند
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
