'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Settings2 } from 'lucide-react';
import { DocumentSourceActionsRow } from '@/components/erp/DocumentSourceActionsRow';
import { erpFieldErrorClass, erpFormGridClass } from '@/components/erp/erpUiTokens';

export function ErpFieldError({ message, show }: { message?: string; show?: boolean }) {
  if (!show || !message) return null;
  return <span className={erpFieldErrorClass}>{message}</span>;
}

type Props = {
  row1: ReactNode;
  row2: ReactNode;
  extras?: ReactNode;
  extrasLabel?: string;
  extrasOpen?: boolean;
  onExtrasOpenChange?: (open: boolean) => void;
  /** القسم / الرقم — أسفل الحقول على الشمال (مع زر الخيارات الإضافية). */
  sourceActions?: ReactNode;
  /** أزرار مساعدة على يمين الصف السفلي (ملاحظات، حجز، …). */
  headerActions?: ReactNode;
  /** Locks header fields after loading a source order, without locking القسم والرقم. */
  fieldsDisabled?: boolean;
};

/** 2×4 grid card + collapsible extras (collapsed by default). */
export function ErpFormHeaderCard({
  row1,
  row2,
  extras,
  extrasLabel = 'خيارات إضافية',
  extrasOpen: extrasOpenProp,
  onExtrasOpenChange,
  sourceActions,
  headerActions,
  fieldsDisabled = false,
}: Props) {
  const [extrasOpenState, setExtrasOpenState] = useState(Boolean(extrasOpenProp));
  const extrasOpen = extrasOpenProp ?? extrasOpenState;

  useEffect(() => {
    if (extrasOpenProp == null) return;
    setExtrasOpenState(extrasOpenProp);
  }, [extrasOpenProp]);

  const setExtrasOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(extrasOpen) : next;
    setExtrasOpenState(resolved);
    onExtrasOpenChange?.(resolved);
  };

  return (
    <Card className="mt-2 min-w-0 max-w-full overflow-hidden rounded-xl border-slate-200 shadow-sm">
      <CardContent className="space-y-3 p-3">
        <fieldset
          disabled={fieldsDisabled}
          className="m-0 w-full min-w-0 max-w-full space-y-3 border-0 p-0 [min-inline-size:0]"
        >
          <div className={erpFormGridClass}>{row1}</div>
          <div className={erpFormGridClass}>{row2}</div>
          {extras ? (
            <div
              className={`grid transition-all duration-200 ease-out overflow-hidden ${
                extrasOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="min-h-0">
                <div className="min-w-0 max-w-full overflow-x-hidden border-t border-slate-100 pt-2">
                  {extras}
                </div>
              </div>
            </div>
          ) : null}
        </fieldset>
        {sourceActions || headerActions || extras ? (
          <DocumentSourceActionsRow className="border-t-0 pt-1">
            {headerActions ? (
              <div className="flex flex-wrap items-end justify-start gap-2 shrink-0 pb-0.5">
                {headerActions}
              </div>
            ) : null}
            <div className="ms-auto flex min-w-0 flex-wrap items-end justify-end gap-2">
              {extras ? (
                <button
                  type="button"
                  onClick={() => setExtrasOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 pb-1.5 text-sm font-medium text-[#0E78AA] transition-colors hover:text-[#094C6B]"
                >
                  <Settings2 className="h-4 w-4" />
                  {extrasLabel} {extrasOpen ? '▴' : '▾'}
                </button>
              ) : null}
              {sourceActions}
            </div>
          </DocumentSourceActionsRow>
        ) : null}
      </CardContent>
    </Card>
  );
}
