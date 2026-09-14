'use client';

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Document page shell — fills the pane, never wider than the viewport. */
export function ErpDocumentLayout({ children, className = '' }: Props) {
  return (
    <div
      className={`${className} erp-contain content-start min-h-0 bg-white p-3`.trim()}
      dir="rtl"
    >
      {children}
    </div>
  );
}
