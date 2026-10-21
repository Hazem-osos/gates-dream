'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** القسم / الرقم — below main fields, packed to the visual left (شمال). */
export function DocumentSourceActionsRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-slate-100 pt-2',
        className
      )}
      data-tour="source-reference"
    >
      {children}
    </div>
  );
}
