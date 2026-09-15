'use client';

import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';
import { GeneratedJournalTab } from '@/components/erp/GeneratedJournalTab';
import { currencyDisplayLabel } from '@/lib/accounting/fx-base';

type Props = {
  totalAmount: number;
  debitTotal?: number;
  creditTotal?: number;
  currencyCode?: string;
  journalEntryId?: string | null;
  journalEntryNumber?: string | null;
  onSave: () => void;
  onCancel: () => void;
  savePending?: boolean;
  canSave?: boolean;
  saveLabel?: string;
  breakdownKind?: 'payment' | 'receipt' | 'bank-debit' | 'bank-credit';
};

function money(value: number, currencyCode: string) {
  return `${value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyDisplayLabel(currencyCode)}`;
}

export function VoucherStickyFooter({
  totalAmount,
  debitTotal,
  creditTotal,
  currencyCode = 'EGP',
  journalEntryId,
  journalEntryNumber,
  onSave,
  onCancel,
  savePending,
  canSave = true,
  saveLabel = 'حفظ السند',
  breakdownKind = 'payment',
}: Props) {
  const showBreakdown = debitTotal != null && creditTotal != null;

  return (
    <div className="sticky bottom-0 z-30 mt-4 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" dir="ltr">
        <GeneratedJournalTab journalEntryId={journalEntryId} journalNumber={journalEntryNumber} />

        <div className="flex flex-wrap items-center gap-3" dir="rtl">
          {showBreakdown ? (
            <DebitCreditTotals
              debit={debitTotal}
              credit={creditTotal}
              currencyCode={currencyCode}
              debitLabel={
                breakdownKind === 'receipt' || breakdownKind === 'bank-credit'
                  ? 'أطراف مدينة'
                  : breakdownKind === 'bank-debit'
                    ? 'المدفوعات'
                    : 'المدفوعات'
              }
              creditLabel={
                breakdownKind === 'receipt'
                  ? 'المقبوضات'
                  : breakdownKind === 'bank-credit'
                    ? 'المقبوضات'
                    : 'أطراف دائنة'
              }
              netLabel={
                breakdownKind === 'receipt'
                  ? 'صافي الخزنة'
                  : breakdownKind === 'bank-credit'
                    ? 'صافي البنك'
                    : breakdownKind === 'bank-debit'
                      ? 'صافي البنك'
                      : 'صافي الخزنة'
              }
              netValue={totalAmount}
              showBalance={false}
            />
          ) : (
            <div className="text-sm">
              <span className="text-muted-foreground">إجمالي السند: </span>
              <span className="text-lg font-bold text-slate-900">{money(totalAmount, currencyCode)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
