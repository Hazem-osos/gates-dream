'use client';

import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';
import { GeneratedJournalTab } from '@/components/erp/GeneratedJournalTab';

type Props = {
  debitTotal: number;
  creditTotal: number;
  currencyCode?: string;
  journalEntryId?: string | null;
  journalNumber?: string | null;
  onSaveDraft: () => void;
  onPost: () => void;
  onCancel: () => void;
  savePending?: boolean;
  postPending?: boolean;
  canSave?: boolean;
  canPost?: boolean;
};

export function OpeningBalanceFooter({
  debitTotal,
  creditTotal,
  currencyCode,
  journalEntryId,
  journalNumber,
  onSaveDraft,
  onPost,
  onCancel,
  savePending,
  postPending,
  canSave = true,
  canPost = true,
}: Props) {
  return (
    <div className="sticky bottom-0 z-30 mt-4 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" dir="ltr">
        <GeneratedJournalTab journalEntryId={journalEntryId} journalNumber={journalNumber} />
        <div dir="rtl" className="flex-1">
          <DebitCreditTotals debit={debitTotal} credit={creditTotal} currencyCode={currencyCode} />
        </div>
      </div>
    </div>
  );
}
