'use client';

import Link from 'next/link';
import { BookText } from 'lucide-react';

type Props = {
  journalEntryId?: string | null;
  journalNumber?: string | null;
};

export function JournalEntryBadge({ journalEntryId, journalNumber }: Props) {
  if (!journalEntryId) {
    return (
      <div className="text-xs text-muted-foreground">سيتم إنشاء القيد المحاسبي عند الترحيل</div>
    );
  }
  const label = journalNumber || `JV-${journalEntryId.slice(0, 8)}`;
  return (
    <Link
      href={`/accounting/operations/journal-entry?id=${encodeURIComponent(journalEntryId)}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      <BookText className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
