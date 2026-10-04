'use client';

import { GeneratedJournalTab } from '@/components/erp/GeneratedJournalTab';

type Props = {
  journalEntryId?: string | null;
  journalNumber?: string | null;
  pendingLabel?: string;
  onPreview?: () => void;
};

export function JournalEntryBadge({
  journalEntryId,
  journalNumber,
  pendingLabel = 'سيتم إنشاء القيد المحاسبي عند الترحيل',
  onPreview,
}: Props) {
  return (
    <GeneratedJournalTab
      journalEntryId={journalEntryId}
      journalNumber={journalNumber}
      pendingLabel={pendingLabel}
      onPreview={onPreview}
    />
  );
}
