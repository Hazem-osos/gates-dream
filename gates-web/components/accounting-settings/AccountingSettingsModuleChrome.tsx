'use client';

import type { ReactNode } from 'react';
import { ErpDocumentLayout } from '@/components/erp';

/** Shared chrome for الإعدادات المحاسبية — matches Erp document pages (slate canvas, no legacy gradient). */
export function AccountingSettingsModuleChrome({ children }: { children: ReactNode }) {
  return (
    <ErpDocumentLayout className="min-h-screen bg-slate-50">
      <div className="mx-auto min-w-0 max-w-[1440px] px-3 py-3 sm:px-4 sm:py-4 lg:px-5">{children}</div>
    </ErpDocumentLayout>
  );
}
