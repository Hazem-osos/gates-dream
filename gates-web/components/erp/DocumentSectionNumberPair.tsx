'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const sectionNumberLabelClass =
  'mb-0.5 block text-[10px] font-semibold tracking-wide text-slate-500';

export const sectionNumberInputClass =
  'h-8 w-full rounded-md border border-[#D6EAF3] bg-[#F8FBFD] px-2 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0E78AA]/20 disabled:cursor-not-allowed disabled:opacity-50';

/** Compact القسم / الرقم chip — sits on the visual left without stretching the form. */
export function DocumentSectionNumberPair({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-wrap items-end gap-1.5 rounded-lg border border-[#D6EAF3] bg-white/90 px-2 py-1 shadow-[0_1px_0_rgba(14,120,170,0.05)]',
        className
      )}
    >
      {children}
    </div>
  );
}
