'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Scrollport for report grids — sticky header + first column (RTL) via `.report-scroll-viewport` in global.css */
export function ReportScrollViewport({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div dir="rtl" className={cn('report-scroll-viewport erp-scroll-x', className)}>
      {children}
    </div>
  );
}
