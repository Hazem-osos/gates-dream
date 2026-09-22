'use client';

import { CalculationInspector } from '@/components/ai/CalculationInspector';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import type { LandedCostBreakdown } from '@/lib/invoices/landed-cost-breakdown';

export function LandedCostInspector({ breakdown }: { breakdown: LandedCostBreakdown }) {
  const rows = [
    {
      label: 'سعر الشراء الأساسي',
      value: `${formatInvoiceMoney(breakdown.baseUnitPrice)} ج.م`,
    },
    {
      label: '= تكلفة الوحدة',
      value: `${formatInvoiceMoney(breakdown.landedUnitCost)} ج.م`,
      tone: 'total' as const,
    },
  ];

  const stockImpact =
    breakdown.previousAverageCost != null && breakdown.projectedAverageCost != null
      ? `رفع متوسط التكلفة المرجح من ${formatInvoiceMoney(breakdown.previousAverageCost)} إلى ${formatInvoiceMoney(
          breakdown.projectedAverageCost
        )} ج.م`
      : breakdown.previousAverageCost != null
        ? `متوسط التكلفة الحالي ${formatInvoiceMoney(breakdown.previousAverageCost)} ج.م — يُحدَّث بعد الترحيل`
        : 'سيُحدَّث متوسط التكلفة المرجح في المخزن بعد ترحيل الفاتورة.';

  return (
    <CalculationInspector
      title="تفاصيل التكلفة"
      triggerLabel="تفاصيل الاحتساب"
      rows={rows}
      footer={<p className="mt-2 border-t border-[#E6F0F7] pt-2 text-[11px] leading-5 text-slate-600">{stockImpact}</p>}
    />
  );
}
