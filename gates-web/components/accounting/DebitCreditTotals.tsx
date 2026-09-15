'use client';

import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatMoneyAr } from '@/lib/formatMoney';
import { currencyDisplayLabel } from '@/lib/accounting/fx-base';

export type DebitCreditTotalsProps = {
  debit: number;
  credit: number;
  debitLabel?: string;
  creditLabel?: string;
  currencyCode?: string;
  showBalance?: boolean;
  netLabel?: string;
  netValue?: number;
  className?: string;
};

function currencySuffix(code: string) {
  return currencyDisplayLabel(code);
}

function amount(value: number, code: string) {
  return `${formatMoneyAr(value)} ${currencySuffix(code)}`;
}

export function DebitCreditTotals({
  debit,
  credit,
  debitLabel = 'المدين',
  creditLabel = 'الدائن',
  currencyCode = 'EGP',
  showBalance = true,
  netLabel,
  netValue,
  className = '',
}: DebitCreditTotalsProps) {
  const diff = Math.round((debit - credit) * 100) / 100;
  const balanced = Math.abs(diff) < 0.005;

  return (
    <div className={`flex flex-wrap items-stretch gap-2 ${className}`} dir="rtl">
      <div className="flex min-w-[9.5rem] flex-1 items-center gap-2.5 rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white px-3 py-2 shadow-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
          <ArrowDownLeft className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-emerald-700">{debitLabel}</p>
          <p className="truncate text-sm font-black tabular-nums text-emerald-900">
            {amount(debit, currencyCode)}
          </p>
        </div>
      </div>

      <div className="flex min-w-[9.5rem] flex-1 items-center gap-2.5 rounded-2xl border border-[#B7E0F2] bg-gradient-to-l from-[#E8F4FA] to-white px-3 py-2 shadow-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0E78AA] text-white shadow-sm">
          <ArrowUpRight className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#0E78AA]">{creditLabel}</p>
          <p className="truncate text-sm font-black tabular-nums text-[#094C6B]">
            {amount(credit, currencyCode)}
          </p>
        </div>
      </div>

      {netLabel != null && netValue != null ? (
        <div className="flex min-w-[9.5rem] flex-1 items-center gap-2.5 rounded-2xl border border-violet-200 bg-gradient-to-l from-violet-50 to-white px-3 py-2 shadow-sm">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-violet-700">{netLabel}</p>
            <p className="truncate text-sm font-black tabular-nums text-violet-950">
              {amount(netValue, currencyCode)}
            </p>
          </div>
        </div>
      ) : null}

      {showBalance ? (
        <div
          className={`flex min-w-[8.5rem] items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold ${
            balanced
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'animate-pulse border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {balanced ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>
            {balanced ? 'القيد متزن' : `فرق ${amount(Math.abs(diff), currencyCode)}`}
          </span>
        </div>
      ) : null}
    </div>
  );
}
