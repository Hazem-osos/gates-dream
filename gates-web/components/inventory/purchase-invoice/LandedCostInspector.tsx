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
      label: '+ نصيب الصنف من مصاريف الشحن',
      value: `+ ${formatInvoiceMoney(breakdown.freightShare)} ج.م`,
      tone: 'plus' as const,
      hint:
        breakdown.invoiceMerchandiseValue > 0
          ? `بنسبة ${breakdown.freightPercentOfInvoice.toLocaleString('ar-EG', {
              maximumFractionDigits: 1,
            })}٪ من إجمالي الفاتورة`
          : undefined,
    },
    {
      label: '- نصيب الصنف من خصم المورد',
      value: `- ${formatInvoiceMoney(breakdown.supplierDiscountShare)} ج.م`,
      tone: 'minus' as const,
    },
    {
      label: '= التكلفة الفعلية للوحدة',
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
      title="تفاصيل التكلفة الفعلية"
      triggerLabel="تفاصيل الاحتساب"
      rows={rows}
      footer={<p className="mt-2 border-t border-[#E6F0F7] pt-2 text-[11px] leading-5 text-slate-600">{stockImpact}</p>}
    />
  );
}
