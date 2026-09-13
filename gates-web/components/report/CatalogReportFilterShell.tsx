'use client';

import type { ReactNode } from 'react';
import { Children, isValidElement } from 'react';
import dynamic from 'next/dynamic';
import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import { ReportFilterLegacyGrid, ReportFilterPageShell } from '@/components/report/reportFilterFields';
import { getReportByUrlPath } from '@/lib/reports/reportCatalog';
import type { ReportSettingsSection } from '@/components/ReportSettingsSidebar';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';

const ReportSettingsSidebar = dynamic(
  () => import('@/components/ReportSettingsSidebar'),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل إعدادات التقرير…" /> }
);

export type CatalogReportFilterShellProps = {
  urlPath: string;
  children: ReactNode;
  onPreview: () => void;
  onReset?: () => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  error?: string;
  onClearError?: () => void;
  subtitle?: string;
  icon?: string;
  previewDisabled?: boolean;
  titleOverride?: string;
  /** Extra sections in إعدادات التقرير drawer */
  settingsSections?: ReportSettingsSection[];
};

/**
 * Wraps legacy filter form fields with unified report filter chrome + catalog title.
 */
export function CatalogReportFilterShell({
  urlPath,
  children,
  onPreview,
  onReset,
  settingsOpen,
  onSettingsOpenChange,
  error,
  onClearError,
  subtitle,
  icon = '📋',
  previewDisabled,
  titleOverride,
  settingsSections,
}: CatalogReportFilterShellProps) {
  const entry = getReportByUrlPath(urlPath);
  const title = titleOverride ?? entry?.titleAr ?? 'تقرير';
  const breadcrumbs = breadcrumbsForReportModule(entry?.module, title);

  const body = (() => {
    try {
      const n = Children.count(children);
      if (n === 1) {
        const only = Children.only(children);
        if (isValidElement(only)) {
          const props = only.props as { className?: string; children?: ReactNode };
          const cn = props.className ?? '';
          if (cn.includes('col-span-full')) {
            return <ReportFilterLegacyGrid>{props.children}</ReportFilterLegacyGrid>;
          }
        }
        return <ReportFilterLegacyGrid>{children}</ReportFilterLegacyGrid>;
      }
    } catch {
      /* multiple children */
    }
    return children;
  })();

  return (
    <ReportFilterPageShell
      error={error}
      onClearError={onClearError}
      title={title}
      description={subtitle}
      breadcrumbs={breadcrumbs}
    >
      {settingsOpen != null && onSettingsOpenChange ? (
        <ReportSettingsSidebar
          open={settingsOpen}
          onClose={() => onSettingsOpenChange(false)}
          customSections={settingsSections}
        />
      ) : null}
      <UnifiedReportFilterCard
        icon={icon}
        title={title}
        subtitle={subtitle}
        showTitle={false}
        onPreview={onPreview}
        onReset={onReset}
        onDesign={onSettingsOpenChange ? () => onSettingsOpenChange(true) : undefined}
        previewDisabled={previewDisabled}
      >
        {body}
      </UnifiedReportFilterCard>
    </ReportFilterPageShell>
  );
}
