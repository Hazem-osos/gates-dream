'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DASHBOARD_CARD_CLASS } from './chrome';

export function DashboardPanel({
  title,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(DASHBOARD_CARD_CLASS, 'p-4', className)} dir="rtl">
      {title ? <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2> : null}
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}
