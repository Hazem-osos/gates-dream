'use client';

import { DASHBOARD_CONTENT_CLASS, DASHBOARD_PAGE_CLASS } from '@/components/dashboard';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/skeletons';

export function SubcontractPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'gates-content-enter',
        DASHBOARD_PAGE_CLASS,
        'font-[family-name:var(--font-subcontracts),Cairo,Tajawal,sans-serif]',
        className
      )}
      dir="rtl"
    >
      <div className={cn(DASHBOARD_CONTENT_CLASS, 'space-y-5')}>{children}</div>
    </div>
  );
}

export function SubcontractCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm', className)}>
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'success';
}) {
  const valueClass =
    tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-[#094C6B]';
  return (
    <div className="rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-lg font-bold tabular-nums', valueClass)}>{value}</p>
    </div>
  );
}

export function SubcontractSkeleton({ tiles = 5 }: { tiles?: number }) {
  return <PageSkeleton variant="workspace" tiles={tiles} className="min-h-0 bg-transparent p-0" />;
}
