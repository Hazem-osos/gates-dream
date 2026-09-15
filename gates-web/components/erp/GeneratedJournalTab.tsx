'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';

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
  if (!journalEntryId) {
    return (
      <span className="inline-flex items-center rounded-t-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] italic text-slate-500">
        {pendingLabel}
      </span>
    );
  }

  return (
    <Link
      href={`/accounting/operations/journal-entry?id=${encodeURIComponent(journalEntryId)}`}
      title="عرض القيد المحاسبي المتولد"
      className="inline-flex items-center gap-1.5 rounded-t-lg border border-[#0E78AA] bg-[#0E78AA] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0c6a96]"
    >
      <FileText className="h-3.5 w-3.5" />
      <span>{journalNumber || 'القيد المتولد'}</span>
    </Link>
  );
}
