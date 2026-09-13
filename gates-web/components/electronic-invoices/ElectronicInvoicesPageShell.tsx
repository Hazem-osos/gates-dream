'use client';

import { DASHBOARD_CONTENT_CLASS, DASHBOARD_PAGE_CLASS } from '@/components/dashboard';
import { cn } from '@/lib/utils';

export function ElectronicInvoicesPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('gates-content-enter', DASHBOARD_PAGE_CLASS, className)} dir="rtl">
      <div className={cn(DASHBOARD_CONTENT_CLASS, 'space-y-5')}>{children}</div>
    </div>
  );
}
