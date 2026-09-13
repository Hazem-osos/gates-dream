'use client';

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DashboardEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)} dir="rtl">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200/75 bg-slate-50 text-slate-400">
        <Inbox className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{description}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#0E79AA] px-3 text-xs font-semibold text-white shadow-[0_1px_2px_rgba(14,121,170,0.25)] hover:bg-[#0B6188]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
