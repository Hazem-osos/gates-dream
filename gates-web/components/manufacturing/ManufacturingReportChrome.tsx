'use client';

import type { ReactNode } from 'react';
import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import { ReportFilterPageShell } from '@/components/report/reportFilterFields';

export function ManufacturingReportChrome({
  title,
  children,
  onPreview,
  onReset,
  onDesign,
  error,
  onClearError,
  previewDisabled,
}: {
  title: string;
  children: ReactNode;
  onPreview: () => void;
  onReset?: () => void;
  onDesign?: () => void;
  error?: string;
  onClearError?: () => void;
  previewDisabled?: boolean;
}) {
  return (
    <ReportFilterPageShell
      title={title}
      breadcrumbs={[
        { label: 'التصنيع', href: '/manufacturing' },
        { label: 'التقارير', href: '/manufacturing/reports' },
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
        onDesign={onDesign}
        previewDisabled={previewDisabled}
      >
        {children}
      </UnifiedReportFilterCard>
    </ReportFilterPageShell>
  );
}
