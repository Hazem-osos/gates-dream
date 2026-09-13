'use client';

import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title = 'لا توجد بيانات',
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 px-4 text-center',
        className
      )}
      dir="rtl"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F7FB] text-[#0E78AA]">
        <Inbox className="h-7 w-7" aria-hidden />
      </div>
      <p className="text-base font-semibold text-[#094C6B]">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-slate-600">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
