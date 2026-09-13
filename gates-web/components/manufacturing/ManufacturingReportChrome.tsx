'use client';

import type { ReactNode } from 'react';
import {
  CommandCenter,
  DASH_PANEL,
  HUD_BTN_GHOST,
  HUD_BTN_PRIMARY,
} from '@/components/dashboard-primitives';

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
    <CommandCenter
      title={title}
      module="MFG / REPORTS"
      shortcuts={[
        { key: 'F8', label: 'التشغيل', href: '/manufacturing' },
        { key: 'F2', label: 'أمر تشغيل', href: '/manufacturing/operations/operation' },
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
          {onDesign ? (
            <button type="button" className={HUD_BTN_GHOST} onClick={onDesign}>
              تخصيص
            </button>
          ) : null}
          <button
            type="button"
            className={HUD_BTN_PRIMARY}
            disabled={previewDisabled}
            onClick={onPreview}
          >
            معاينة التقرير
          </button>
        </div>
      </div>
    </CommandCenter>
  );
}
