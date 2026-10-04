'use client';

export type InvoicePaymentMethod = 'cash' | 'credit' | 'split';

const MONEY_EPS = 0.009;

export function shownCashPaid(_method: InvoicePaymentMethod, paidAmount: number, _netAmount: number): number {
  return paidAmount > MONEY_EPS ? paidAmount : 0;
}

export function invoicePaymentStatusLabel(
  _method: InvoicePaymentMethod,
  paidAmount: number,
  netAmount: number
): string {
  if (netAmount > MONEY_EPS && paidAmount > MONEY_EPS && Math.abs(paidAmount - netAmount) <= MONEY_EPS) {
    return 'نقدي';
  }
  return 'آجل';
}

/** Empty or below the net stays on account. An amount equal to the net is cash. */
export function paymentMethodForCashPaid(paid: number, netAmount: number): 'cash' | 'credit' {
  if (netAmount > MONEY_EPS && paid > MONEY_EPS && Math.abs(paid - netAmount) <= MONEY_EPS) return 'cash';
  return 'credit';
}

type Props = {
  netAmount: number;
  paidAmount: number;
  method: InvoicePaymentMethod;
  disabled?: boolean;
  onPaidChange?: (amount: number | null) => void;
  onOpenSplit?: () => void;
  splitLocked?: boolean;
  onOpenInstallments?: () => void;
  installmentCount?: number;
  onLinkAdvance?: () => void;
  linkHint?: string;
  splitSummary?: string;
};

export function InvoicePaymentStatusLine({
  method,
  paidAmount,
  netAmount,
}: {
  method: InvoicePaymentMethod;
  paidAmount: number;
  netAmount: number;
}) {
  const label = invoicePaymentStatusLabel(method, paidAmount, netAmount);
  const tone = label === 'آجل' ? 'text-slate-600' : 'text-emerald-700';
  return (
    <p className={`mb-2 text-xs font-bold ${tone}`}>
      حالة الفاتورة: <span className="text-sm font-black">{label}</span>
    </p>
  );
}

export function InvoiceCashPaidControls({
  netAmount,
  paidAmount,
  method,
  disabled,
  onOpenSplit,
  splitSummary,
}: Props) {
  const shown = shownCashPaid(method, paidAmount, netAmount);
  const value = shown.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <label className="min-w-[9rem] text-xs font-semibold text-slate-600">
        المبلغ المدفوع
        <input
          readOnly
          tabIndex={-1}
          value={value}
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none"
        />
      </label>
      {onOpenSplit ? (
        <button
          type="button"
          disabled={disabled}
          className="h-14 w-full basis-full rounded-xl bg-gradient-to-l from-[#047857] via-[#059669] to-[#34D399] text-lg font-black text-white shadow-md shadow-emerald-900/20 transition hover:from-[#065F46] hover:via-[#047857] hover:to-[#10B981] disabled:opacity-50"
          onClick={onOpenSplit}
        >
          الدفع
        </button>
      ) : null}
      {splitSummary ? <p className="w-full basis-full text-[11px] text-slate-500">{splitSummary}</p> : null}
    </>
  );
}
