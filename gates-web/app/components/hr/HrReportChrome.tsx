'use client';

import type { ReactNode } from 'react';
import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import { ReportFilterPageShell } from '@/components/report/reportFilterFields';

export function HrReportChrome({
  title,
  children,
  onPreview,
  onReset,
  error,
  onClearError,
  previewDisabled,
}: {
  title: string;
  children: ReactNode;
  onPreview: () => void;
  onReset?: () => void;
  error?: string;
  onClearError?: () => void;
  previewDisabled?: boolean;
  previewLabel?: string;
}) {
  return (
    <ReportFilterPageShell
      title={title}
      breadcrumbs={[
        { label: 'الموارد البشرية', href: '/hr' },
        { label: 'التقارير', href: '/hr/reports' },
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
    </ReportFilterPageShell>
  );
}
