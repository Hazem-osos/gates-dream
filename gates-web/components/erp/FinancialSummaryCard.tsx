'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { tafqeetEgp } from '@/lib/print/tafqeet';
import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';

export type FinancialSummaryRow = {
  label: string;
  value: number;
  /** Show row only when true (default true) */
  show?: boolean;
  dataTour?: string;
  suffix?: ReactNode;
};

type Props = {
  title?: string;
  rows: FinancialSummaryRow[];
  netLabel?: string;
  netAmount: number;
  showTafqeet?: boolean;
  footer?: ReactNode;
};

export function FinancialSummaryCard({
  title = 'الملخص المالي',
  rows,
  netLabel = 'الصافي المستحق',
  netAmount,
  showTafqeet = true,
  footer,
}: Props) {
  const visible = rows.filter((r) => r.show !== false);
  const debitRow = visible.find((r) => r.label === 'إجمالي المدين' || r.label === 'المدين' || r.label === 'مدين');
  const creditRow = visible.find((r) => r.label === 'إجمالي الدائن' || r.label === 'الدائن' || r.label === 'دائن');
  const otherRows =
    debitRow && creditRow
      ? visible.filter((r) => r !== debitRow && r !== creditRow)
      : visible;

  return (
    <Card className="border-slate-200 shadow-md rounded-xl overflow-hidden h-full">
      <CardContent className="p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">{title}</h3>
        {debitRow && creditRow ? (
          <DebitCreditTotals debit={debitRow.value} credit={creditRow.value} className="mb-3" />
        ) : null}
        <dl className="space-y-0">
          {otherRows.map((r) => (
            <SummaryRow key={r.label} label={r.label} value={r.value} dataTour={r.dataTour} suffix={r.suffix} />
          ))}
        </dl>
        <div className="bg-[#0E78AA]/5 text-[#0E78AA] rounded-xl p-3 mt-3">
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-sm font-bold">{netLabel}</span>
            <span className="text-2xl font-black tabular-nums">
              {formatInvoiceMoney(netAmount)} <span className="text-sm font-semibold">ج.م</span>
            </span>
          </div>
          {showTafqeet ? (
            <p
              className="text-xs text-slate-500 font-medium mt-2 leading-relaxed"
              data-tour="tafqeet-indicator"
            >
              {tafqeetEgp(netAmount)}
            </p>
          ) : null}
        </div>
        {footer ? <div className="mt-3 pt-2 border-t border-slate-100">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  dataTour,
  suffix,
}: {
  label: string;
  value: number;
  dataTour?: string;
  suffix?: ReactNode;
}) {
  const prefix = value < 0 ? '−' : '';
  return (
    <div className="text-sm text-slate-600 flex justify-between py-1 border-b border-slate-100" data-tour={dataTour}>
      <span className="inline-flex items-center gap-1">
        {label}
        {suffix}
      </span>
      <span className="font-medium tabular-nums text-slate-800">
        {prefix}
        {formatInvoiceMoney(Math.abs(value))} ج.م
      </span>
    </div>
  );
}
