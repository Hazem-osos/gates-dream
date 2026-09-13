'use client';

import { JournalSourceBadge } from '@/components/accounting/JournalSourceBadge';
import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';
import type { JournalSourceType } from '@/lib/accounting/journal-source';

type Props = {
  debitTotal: number;
  creditTotal: number;
  currencyCode?: string;
  sourceType?: JournalSourceType;
  sourceId?: string | null;
  sourceNumber?: string | null;
  onSaveDraft: () => void;
  onPost: () => void;
  onCancel: () => void;
  savePending?: boolean;
  postPending?: boolean;
  canSave?: boolean;
  canPost?: boolean;
  postRequiresSave?: boolean;
};

export function JournalEntryStickyFooter({
  debitTotal,
  creditTotal,
  currencyCode = 'EGP',
  sourceType = 'MANUAL',
  sourceId,
  sourceNumber,
  onSaveDraft,
  onPost,
  onCancel,
  savePending,
  postPending,
  canSave = true,
  canPost = true,
  postRequiresSave,
}: Props) {
  return (
    <div className="sticky bottom-0 z-30 mt-4 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" dir="ltr">
        <div className="flex flex-wrap items-center gap-2" dir="rtl">
          <span className="text-xs font-medium text-muted-foreground">المصدر</span>
          <JournalSourceBadge
            sourceType={sourceType}
            sourceKind={sourceType}
            sourceId={sourceId}
            sourceNumber={sourceNumber}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3" dir="rtl">
          <DebitCreditTotals
            debit={debitTotal}
            credit={creditTotal}
            currencyCode={currencyCode}
          />
        </div>
      </div>
    </div>
  );
}
