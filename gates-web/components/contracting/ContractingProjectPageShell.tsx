'use client';

import { DASHBOARD_CONTENT_CLASS, DASHBOARD_PAGE_CLASS } from '@/components/dashboard';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/skeletons';

export function ContractingProjectPageShell({
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
        'font-[family-name:var(--font-contracting),Cairo,Tajawal,sans-serif]',
        className
      )}
      dir="rtl"
    >
      <div className={cn(DASHBOARD_CONTENT_CLASS, 'space-y-5')}>{children}</div>
    </div>
  );
}

export function ProjectCard({
  children,
  className,
  title,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm', className)}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-lg font-bold text-[#0E79AA]">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'danger' | 'success' | 'warning';
}) {
  const valueClass =
    tone === 'danger'
      ? 'text-red-700'
      : tone === 'success'
        ? 'text-emerald-700'
        : tone === 'warning'
          ? 'text-amber-700'
          : 'text-[#094C6B]';
  return (
    <div className="rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-lg font-bold tabular-nums', valueClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ProjectWorkspaceSkeleton({ tiles = 5 }: { tiles?: number }) {
  return <PageSkeleton variant="workspace" tiles={tiles} className="min-h-0 bg-transparent p-0" />;
}
