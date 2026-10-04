'use client';

import { FileText } from 'lucide-react';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { useRouter } from 'next/navigation';

type Props = {
  journalEntryId?: string | null;
  journalNumber?: string | null;
  pendingLabel?: string;
  onPreview?: () => void;
};

export function GeneratedJournalTab({
  journalEntryId,
  journalNumber,
  pendingLabel = 'يتولد القيد آلياً فور الحفظ',
  onPreview,
}: Props) {
  const router = useRouter();
  const tabs = useAppTabs();

  const openJournal = () => {
    onPreview?.();
    if (!journalEntryId) return;
    const href = `/accounting/operations/journal-entry?id=${encodeURIComponent(journalEntryId)}`;
    if (tabs) {
      tabs.openAppTab(href);
      return;
    }
    router.push(destinationAppTabHref(href));
  };

  if (!journalEntryId) {
    return (
      <button
        type="button"
        onClick={openJournal}
        title="معاينة القيد المحاسبي"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#0E78AA]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#0E78AA] shadow-sm hover:bg-[#E8F4FA]"
      >
        <FileText className="h-3.5 w-3.5" />
        <span>{pendingLabel || 'معاينة القيد المحاسبي'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openJournal}
      title="فتح القيد المحاسبي"
      className="inline-flex items-center gap-1.5 rounded-t-lg border border-[#0E78AA] bg-[#0E78AA] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0c6a96]"
    >
      <FileText className="h-3.5 w-3.5" />
      <span>{journalNumber || 'معاينة القيد المحاسبي'}</span>
    </button>
  );
}
