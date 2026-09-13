'use client';

import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';

type Props = {
  debitTotal: number;
  creditTotal: number;
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" dir="rtl">
        <DebitCreditTotals debit={debitTotal} credit={creditTotal} className="flex-1" />
      </div>
    </div>
  );
}
