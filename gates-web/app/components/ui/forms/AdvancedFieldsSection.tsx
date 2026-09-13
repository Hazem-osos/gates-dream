'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdvancedFieldsSectionProps = {
  title?: string;
  badgeCount?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function AdvancedFieldsSection({
  title = 'الحقول والإعدادات المتقدمة',
  badgeCount = 0,
  defaultOpen = false,
  children,
  className,
}: AdvancedFieldsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn('mb-4', className)} dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-[#D6EAF3] bg-[#F6FBFD] px-4 py-2.5 text-right transition-colors hover:border-[#0E78AA]/50 hover:bg-white"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#094C6B]">{title}</span>
          {badgeCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#0E78AA] px-1.5 text-[11px] font-bold text-white">
              {badgeCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[#0E78AA] transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-3 space-y-4">{children}</div>
        </div>
      </div>
    </section>
  );
}
