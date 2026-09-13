'use client';

import Link from 'next/link';
import { ArrowUpLeft, FileText } from 'lucide-react';
import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';

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
  })} ${currencyCode === 'EGP' ? 'ج.م' : currencyCode}`;
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
        <div className="flex items-center gap-2" dir="rtl">
          <span className="text-xs font-medium text-muted-foreground">القيد المحاسبي:</span>
          {journalEntryId ? (
            <Link
              href={`/accounting/operations/journal-entry?id=${encodeURIComponent(journalEntryId)}`}
              title="عرض القيد المحاسبي المتولد"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{journalEntryNumber || 'JV-2026-XXXX'}</span>
              <ArrowUpLeft className="h-3 w-3" />
            </Link>
          ) : (
            <span className="rounded border border-border bg-muted px-2 py-0.5 text-xs italic text-muted-foreground/80">
              يتولد القيد آلياً فور الحفظ
            </span>
          )}
        </div>

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
