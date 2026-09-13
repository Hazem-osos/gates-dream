'use client';

import type { ReactNode } from 'react';
import {
  CommandCenter,
  DASH_PANEL,
  HUD_BTN_GHOST,
  HUD_BTN_PRIMARY,
} from '@/components/dashboard-primitives';

export function HrReportChrome({
  title,
  children,
  onPreview,
  onReset,
  error,
  onClearError,
  previewDisabled,
  previewLabel = 'معاينة التقرير',
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
    <CommandCenter
      title={title}
      module="HR / REPORTS"
      shortcuts={[
        { key: 'F8', label: 'التشغيل', href: '/hr' },
        { key: 'F6', label: 'التقارير', href: '/hr/reports' },
        { key: 'F2', label: 'مسير', href: '/hr/monthly-salaries' },
      ]}
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
          {error}
          {onClearError ? (
            <button type="button" className="ms-2 underline" onClick={onClearError}>
              إخفاء
            </button>
          ) : null}
        </p>
      ) : null}
      <div className={`${DASH_PANEL} p-5`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          {onReset ? (
            <button type="button" className={HUD_BTN_GHOST} onClick={onReset}>
              إعادة ضبط
            </button>
          ) : null}
          <button
            type="button"
            className={HUD_BTN_PRIMARY}
            disabled={previewDisabled}
            onClick={onPreview}
          >
            {previewLabel}
          </button>
        </div>
      </div>
    </CommandCenter>
  );
}
