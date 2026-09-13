'use client';

import { DASHBOARD_CONTENT_CLASS, DASHBOARD_PAGE_CLASS } from '@/components/dashboard';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/skeletons';

export function RealEstatePageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'gates-content-enter',
        DASHBOARD_PAGE_CLASS,
        'font-[family-name:var(--font-real-estate),Cairo,Tajawal,sans-serif]'
      )}
      dir="rtl"
    >
      <div className={cn(DASHBOARD_CONTENT_CLASS, 'space-y-5')}>{children}</div>
    </div>
  );
}

export function ReCard({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm', className)}>
      {children}
    </section>
  );
}

export function ReMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
}) {
  return (
    <div className="rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-bold tabular-nums',
          tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-[#094C6B]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ReSkeleton() {
  return <PageSkeleton variant="workspace" tiles={4} className="min-h-0 bg-transparent p-0" />;
}
