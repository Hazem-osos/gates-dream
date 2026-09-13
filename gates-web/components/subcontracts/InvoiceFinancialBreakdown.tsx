'use client';

import { cn } from '@/lib/utils';
import { formatEgp } from '@/lib/subcontracts/money';
import type { LiveInvoiceBreakdown, SubcontractInvoice } from '@/lib/subcontracts/types';
import { toMoney } from '@/lib/subcontracts/money';

type Row = { label: string; amount: number; sign: '+' | '-' | '=' };

function rowsFromLive(live: LiveInvoiceBreakdown): Row[] {
  return [
    { label: 'إجمالي الأعمال الحالية', amount: live.grossCurrentAmount, sign: '+' },
    { label: 'استرداد دفعة مقدمة', amount: live.advancePaymentDeduction, sign: '-' },
    { label: 'تأمين أعمال محتجز (5–10٪)', amount: live.retentionDeduction, sign: '-' },
    { label: 'خصم ضريبة أرباح تجارية نموذج 41 (1٪)', amount: live.taxWithholdingDeduction, sign: '-' },
    { label: 'تأمينات اجتماعية', amount: live.socialInsuranceDeduction, sign: '-' },
    { label: 'هوالك خامات الموقع', amount: live.materialOveruseDeduction, sign: '-' },
    { label: 'غرامات تأخير وجودة', amount: live.sitePenaltiesDeduction, sign: '-' },
    { label: 'تنفيذ على حساب المقاول', amount: live.directExecutionDeduction, sign: '-' },
    { label: 'خصم تعجيل الصرف', amount: live.earlyPaymentDiscountDeduction, sign: '-' },
    { label: 'صافي المستحق للصرف', amount: live.netPayableAmount, sign: '=' },
  ];
}

function rowsFromInvoice(invoice: SubcontractInvoice): Row[] {
  return rowsFromLive({
    grossCurrentAmount: toMoney(invoice.grossCurrentAmount),
    advancePaymentDeduction: toMoney(invoice.advancePaymentDeduction),
    retentionDeduction: toMoney(invoice.retentionDeduction),
    taxWithholdingDeduction: toMoney(invoice.taxWithholdingDeduction),
    socialInsuranceDeduction: toMoney(invoice.socialInsuranceDeduction),
    materialOveruseDeduction: toMoney(invoice.materialOveruseDeduction),
    sitePenaltiesDeduction: toMoney(invoice.sitePenaltiesDeduction),
    directExecutionDeduction: toMoney(invoice.directExecutionDeduction),
    earlyPaymentDiscountDeduction: toMoney(invoice.earlyPaymentDiscountDeduction),
    netPayableAmount: toMoney(invoice.netPayableAmount),
    remainingAdvanceAfter: 0,
    lines: [],
  });
}

export function InvoiceFinancialBreakdown({
  live,
  invoice,
  highlight,
}: {
  live?: LiveInvoiceBreakdown;
  invoice?: SubcontractInvoice;
  highlight?: boolean;
}) {
  const rows = live ? rowsFromLive(live) : invoice ? rowsFromInvoice(invoice) : [];
  const net = rows.find((row) => row.sign === '=')?.amount ?? 0;

  return (
    <aside
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm transition-shadow',
        highlight ? 'border-[#0E79AA] ring-2 ring-[#0E79AA]/30' : 'border-[#D6EAF3]'
      )}
    >
      <h3 className="mb-3 text-sm font-bold text-[#0E79AA]">التسوية المالية الحية</h3>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => {
          const isNet = row.sign === '=';
          return (
            <li
              key={row.label}
              className={cn(
                'flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0',
                isNet && 'pt-2'
              )}
            >
              <span className={cn('text-slate-600', isNet && 'font-bold text-[#094C6B]')}>
                <span className="ml-1 text-xs text-slate-400">{row.sign}</span>
                {row.label}
              </span>
              <span
                className={cn(
                  'shrink-0 tabular-nums font-semibold',
                  isNet ? (net < 0 ? 'text-red-600' : 'text-emerald-700') : 'text-[#094C6B]'
                )}
              >
                {formatEgp(row.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
