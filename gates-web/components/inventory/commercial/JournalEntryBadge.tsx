'use client';

import { GeneratedJournalTab } from '@/components/erp/GeneratedJournalTab';

type Props = {
  journalEntryId?: string | null;
  journalNumber?: string | null;
  pendingLabel?: string;
};

export function JournalEntryBadge({
  journalEntryId,
  journalNumber,
  pendingLabel = 'سيتم إنشاء القيد المحاسبي عند الترحيل',
}: Props) {
  return (
    <GeneratedJournalTab
      journalEntryId={journalEntryId}
      journalNumber={journalNumber}
      pendingLabel={pendingLabel}
    />
  );
}
