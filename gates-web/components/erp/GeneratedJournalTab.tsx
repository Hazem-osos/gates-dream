'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { LiveJournalPreviewTable } from '@/components/erp/LiveJournalPreviewTable';

type Props = {
  journalEntryId?: string | null;
  journalNumber?: string | null;
  pendingLabel?: string;
};

export function GeneratedJournalTab({
  journalEntryId,
  journalNumber,
  pendingLabel = 'يتولد القيد آلياً فور الحفظ',
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!journalEntryId) {
    return (
      <span className="inline-flex items-center rounded-t-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] italic text-slate-500">
        {pendingLabel}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="معاينة القيد المحاسبي"
        className={`inline-flex items-center gap-1.5 rounded-t-lg border px-3 py-1.5 text-xs font-semibold shadow-sm ${
          open
            ? 'border-[#0c6a96] bg-[#0c6a96] text-white'
            : 'border-[#0E78AA] bg-[#0E78AA] text-white hover:bg-[#0c6a96]'
        }`}
      >
        <FileText className="h-3.5 w-3.5" />
        <span>{journalNumber || 'معاينة القيد المحاسبي'}</span>
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#D6EAF3] bg-white shadow-xl"
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-[#E8F1F6] bg-[#F6FBFD] px-3 py-2">
            <span className="text-xs font-semibold text-[#0E78AA]">معاينة القيد المحاسبي</span>
            {journalNumber ? (
              <span className="font-mono text-[11px] text-slate-500">{journalNumber}</span>
            ) : null}
          </div>
          <div className="max-h-64 overflow-auto p-2">
            <LiveJournalPreviewTable journalEntryId={journalEntryId} title="" compact />
          </div>
        </div>
      ) : null}
    </div>
  );
}
