'use client';

import { JournalEntryBadge } from '@/components/inventory/commercial/JournalEntryBadge';

type Props = {
  saveLabel: string;
  savePending?: boolean;
  canSave?: boolean;
  netTotal: number;
  journalEntryId?: string | null;
  onSave: () => void;
  onCancel: () => void;
};

export function ReturnStickyFooter({
  saveLabel,
  savePending,
  canSave = true,
  netTotal,
  journalEntryId,
  onSave,
  onCancel,
}: Props) {
  return (
    <div className="sticky bottom-0 z-30 mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-6 py-3 shadow-lg backdrop-blur-md" dir="ltr">
      <JournalEntryBadge journalEntryId={journalEntryId} />
      <div className="flex flex-wrap items-center gap-3" dir="rtl">
        <div className="text-sm">
          الصافي:{' '}
          <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
            {netTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
          </span>
        </div>
      </div>
    </div>
  );
}
