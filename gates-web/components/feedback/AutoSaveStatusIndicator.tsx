'use client';

import { AlertCircle, Check, Loader2 } from 'lucide-react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  status: AutosaveStatus;
};

export function AutoSaveStatusIndicator({ status }: Props) {
  if (status === 'idle') return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/90 px-2 py-0.5"
      aria-live="polite"
      aria-atomic="true"
    >
      {status === 'saving' ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-hidden />
          <span className="text-xs text-slate-400 font-medium">جارٍ الحفظ...</span>
        </>
      ) : null}
      {status === 'saved' ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden />
          <span className="text-xs text-slate-500 font-medium">محفوظ</span>
        </>
      ) : null}
      {status === 'error' ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" aria-hidden />
          <span className="text-xs text-rose-500 font-medium">فشل الحفظ</span>
        </>
      ) : null}
    </span>
  );
}
