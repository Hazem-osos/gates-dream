'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { reportFilterUnifiedFieldsClass } from '@/components/report/reportFilterFields';

export type UnifiedReportFilterCardProps = {
  icon?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onPreview: () => void;
  onReset?: () => void;
  onDesign?: () => void;
  designLabel?: string;
  previewDisabled?: boolean;
  toolbarExtra?: ReactNode;
  /** @default 'wide' — 4 columns on xl */
  layout?: 'wide' | 'compact';
  /** When false, title/subtitle render only via ReportFilterPageShell PageHeader */
  showTitle?: boolean;
};

export function UnifiedReportFilterCard({
  icon = '📋',
  title,
  subtitle,
  children,
  onPreview,
  onReset,
  onDesign,
  designLabel = 'تخصيص / تصميم',
  previewDisabled,
  toolbarExtra,
  layout = 'wide',
  showTitle = true,
}: UnifiedReportFilterCardProps) {
  const gridClass =
    layout === 'compact'
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

  return (
    <div className={cn('w-full max-w-none', showTitle ? 'my-4 md:my-6' : 'mb-4 md:mb-6')} dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 md:p-5">
        {showTitle ? (
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 text-right">
              <div className="flex items-center gap-2 justify-end mb-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                <span className="text-xl" aria-hidden>
                  {icon}
                </span>
              </div>
              {subtitle ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              ) : null}
            </div>
            {toolbarExtra}
          </div>
        ) : toolbarExtra ? (
          <div className="flex justify-end mb-3">{toolbarExtra}</div>
        ) : null}

        <div className={`${gridClass} ${reportFilterUnifiedFieldsClass}`}>{children}</div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#D6EAF3] px-3 text-xs font-semibold text-[#094C6B] hover:bg-[#F6FBFD] sm:text-sm"
            >
              <span aria-hidden>↺</span>
              إعادة ضبط الفلاتر
            </button>
          ) : null}
          {onDesign ? (
            <button
              type="button"
              onClick={onDesign}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#D6EAF3] px-3 text-xs font-semibold text-[#094C6B] hover:bg-[#F6FBFD] sm:text-sm"
            >
              <span aria-hidden>⚙️</span>
              {designLabel}
            </button>
          ) : null}
          <button
            type="button"
            disabled={previewDisabled}
            onClick={onPreview}
            data-tour-id="report-preview-btn"
            data-academy-trigger-id="report.preview-click"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0E79AA] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#094C6B] disabled:opacity-50 sm:text-sm"
          >
            <span aria-hidden>👁️</span>
            معاينة التقرير
          </button>
        </div>
      </div>
    </div>
  );
}
