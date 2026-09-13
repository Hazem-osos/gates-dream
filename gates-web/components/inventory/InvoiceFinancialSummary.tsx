'use client';

import type { InvoiceFinancialSummary as Summary } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';

type Props = {
  summary: Summary;
  taxLabel?: string;
  children?: React.ReactNode;
};

export function InvoiceFinancialSummary({
  summary,
  taxLabel = 'ضريبة القيمة المضافة (ض.ق.م)',
  children,
}: Props) {
  return (
    <div className="mt-6 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-br from-[#0E78AA] to-[#0A5F8A] rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#0A3D5E]">الملخص المالي</h3>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <SummaryRow label="إجمالى الفاتورة بدون ضرائب" value={summary.subtotalWithoutTax} />
        <SummaryRow label={taxLabel} value={summary.taxAmount} />
        {summary.developmentFeeAmount !== 0 ? (
          <SummaryRow label="رسم التنمية" value={summary.developmentFeeAmount} />
        ) : null}
        <SummaryRow label="ضريبة خصم المنبع" value={summary.withholdingTaxAmount} />
        <SummaryRow label="الإضافات والخصومات" value={summary.additionsAndDiscounts} />
        <SummaryRow label="إجمالى الهدايا" value={summary.giftsTotal} />
        <div className="bg-gradient-to-r from-[#0E78AA] to-[#0A5F8A] rounded-lg p-4 text-white shadow-lg">
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">القيمة الصافية</span>
            <span className="font-bold text-xl">{formatInvoiceMoney(summary.netAmount)}</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-blue-100">
      <div className="flex justify-between items-center">
        <span className="text-[#0A3D5E] font-medium">{label}</span>
        <span className="font-bold text-[#0E78AA] text-lg">{formatInvoiceMoney(value)}</span>
      </div>
    </div>
  );
}
