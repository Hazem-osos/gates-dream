'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { erpFormGridClass } from '@/components/erp/erpUiTokens';

export type FormSectionCardProps = {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function FormSectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  bodyClassName,
}: FormSectionCardProps) {
  return (
    <section
      className={cn(
        'mb-4 min-w-0 max-w-full rounded-xl border border-[#E6F0F7] bg-white p-3 shadow-sm sm:p-4 lg:p-5',
        className
      )}
      dir="rtl"
    >
      {title ? (
        <header className="mb-4 flex items-start gap-2">
          {Icon ? (
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF6FB] text-[#0E78AA]">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </header>
      ) : null}
      <div
        className={
          bodyClassName
            ? cn('grid min-w-0 max-w-full grid-cols-1 gap-3', bodyClassName)
            : erpFormGridClass
        }
      >
        {children}
      </div>
    </section>
  );
}
