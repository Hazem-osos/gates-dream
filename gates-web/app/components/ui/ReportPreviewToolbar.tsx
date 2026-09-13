'use client';

import type { ReactNode } from 'react';
import { TbBrush, TbEye, TbFileExport, TbPrinter } from 'react-icons/tb';
import { cn } from '@/lib/utils';

/** Shared class for toolbar actions (white surface, blue text/icons). */
export const reportToolbarActionClass =
  'inline-flex items-center gap-2 rounded-lg border border-[#D6EAF3] bg-white px-4 py-2 text-sm font-semibold text-[#094C6B] shadow-sm transition hover:bg-[#F6FBFD] hover:border-[#0E79AA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E79AA]/30';

export const reportToolbarIconClass = 'h-4 w-4 shrink-0 text-[#0E79AA]';

type ReportPreviewToolbarProps = {
  /** e.g. extra «السيريال» on inventory stock preview */
  extra?: ReactNode;
  className?: string;
};

/**
 * تصميم / تصدير / معاينة / طباعة — consistent white buttons and outline-style icons
 * (replaces mixed SVG + invert on blue fills).
 */
export default function ReportPreviewToolbar({ extra, className }: ReportPreviewToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 items-center justify-end bg-white p-4 rounded-lg shadow-sm border border-[#E6F0F7]',
        className
      )}
    >
      <button type="button" className={reportToolbarActionClass}>
        <TbBrush className={reportToolbarIconClass} aria-hidden />
        تصميم
      </button>
      <button type="button" className={reportToolbarActionClass}>
        <TbFileExport className={reportToolbarIconClass} aria-hidden />
        تصدير
      </button>
      <button type="button" className={reportToolbarActionClass}>
        <TbEye className={reportToolbarIconClass} aria-hidden />
        معاينة
      </button>
      <button type="button" className={reportToolbarActionClass}>
        <TbPrinter className={reportToolbarIconClass} aria-hidden />
        طباعة
      </button>
      {extra}
    </div>
  );
}
