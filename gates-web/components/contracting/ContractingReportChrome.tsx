'use client';

import type { ReactNode } from 'react';
import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import { ReportFilterPageShell } from '@/components/report/reportFilterFields';

export function ContractingReportChrome({
  title,
  children,
  onPreview,
  onReset,
  error,
  onClearError,
  previewDisabled,
  below,
}: {
  title: string;
  children: ReactNode;
  onPreview: () => void;
  onReset?: () => void;
  error?: string;
  onClearError?: () => void;
  previewDisabled?: boolean;
  below?: ReactNode;
}) {
  return (
    <ReportFilterPageShell
      title={title}
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { href: '/contracting/reports', label: 'التقارير' },
        { label: title },
      ]}
      error={error}
      onClearError={onClearError}
    >
      <UnifiedReportFilterCard
        title={title}
        showTitle={false}
        onPreview={onPreview}
        onReset={onReset}
        previewDisabled={previewDisabled}
      >
        {children}
      </UnifiedReportFilterCard>
      {below}
    </ReportFilterPageShell>
  );
}
