'use client';

import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASHBOARD_CONTENT_CLASS, DASHBOARD_PAGE_CLASS } from './chrome';
import { PeriodSegmentedControl } from './PeriodSegmentedControl';
import { relativeUpdatedLabel } from './period';
import type { DashboardPeriod } from './types';

export function ModuleDashboardLayout({
  title,
  description,
  breadcrumbs,
  period,
  onPeriodChange,
  onRefresh,
  refreshing,
  extraActions,
  children,
  className,
  embedded,
  asOf,
}: {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  extraActions?: ReactNode;
  children: ReactNode;
  className?: string;
  embedded?: boolean;
  asOf?: string;
}) {
  const subtitle = description ?? relativeUpdatedLabel(asOf);
  return (
    <div
      className={cn(embedded ? 'min-h-0 bg-transparent p-0' : DASHBOARD_PAGE_CLASS, className)}
      dir="rtl"
    >
      <div className={embedded ? 'w-full' : DASHBOARD_CONTENT_CLASS}>
        <PageHeader
          title={title}
          description={subtitle}
          breadcrumbs={breadcrumbs}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {extraActions}
              {onRefresh ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onRefresh}
                  isLoading={refreshing}
                  iconStart={<RefreshCw className="h-4 w-4" />}
                >
                  تحديث البيانات
                </Button>
              ) : null}
            </div>
          }
        />
        {period && onPeriodChange ? (
          <div className="mb-5">
            <PeriodSegmentedControl value={period} onChange={onPeriodChange} />
          </div>
        ) : null}
        <div className="grid grid-cols-12 items-start gap-5 [&>*]:col-span-12">{children}</div>
      </div>
    </div>
  );
}
