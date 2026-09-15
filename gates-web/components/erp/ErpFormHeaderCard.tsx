'use client';

import { useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Settings2 } from 'lucide-react';
import { erpFieldErrorClass } from '@/components/erp/erpUiTokens';

export function ErpFieldError({ message, show }: { message?: string; show?: boolean }) {
  if (!show || !message) return null;
  return <span className={erpFieldErrorClass}>{message}</span>;
}

type Props = {
  row1: ReactNode;
  row2: ReactNode;
  extras?: ReactNode;
  extrasLabel?: string;
  /** Shown beside the extras toggle (e.g. internal notes). */
  headerActions?: ReactNode;
};

/** 2×4 grid card + collapsible extras (collapsed by default). */
export function ErpFormHeaderCard({ row1, row2, extras, extrasLabel = 'خيارات إضافية', headerActions }: Props) {
  const [extrasOpen, setExtrasOpen] = useState(false);

  return (
    <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden mt-2">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{row1}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{row2}</div>
        {extras ? (
          <>
            <div className="flex w-full flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setExtrasOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm text-[#0E78AA] font-medium hover:text-[#094C6B] transition-colors"
              >
                <Settings2 className="h-4 w-4" />
                {extrasLabel} {extrasOpen ? '▴' : '▾'}
              </button>
              {headerActions}
            </div>
            <div
              className={`grid transition-all duration-200 ease-out overflow-hidden ${
                extrasOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="min-h-0">
                <div className="pt-2 border-t border-slate-100">{extras}</div>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
