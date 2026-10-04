'use client';

import { CalculationInspector } from '@/components/ai/CalculationInspector';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';

type Props = {
  averageCost?: number | null;
  onHandQuantity?: number | null;
};

/** Same average-cost hint the purchase invoice shows, for sales and returns. */
export function AverageCostInspector({ averageCost, onHandQuantity }: Props) {
  const hasCost = averageCost != null && Number.isFinite(averageCost);
  const hasQty = onHandQuantity != null && Number.isFinite(onHandQuantity);
  const costLabel = hasCost ? `${formatInvoiceMoney(averageCost)} ج.م` : '—';

  return (
    <CalculationInspector
      title="متوسط التكلفة"
      triggerLabel="متوسط التكلفة"
      rows={[
        {
          label: 'متوسط التكلفة الحالي',
          value: costLabel,
          tone: 'total',
        },
        ...(hasQty
          ? [
              {
                label: 'الكمية المتاحة',
                value: onHandQuantity.toLocaleString('ar-EG', { maximumFractionDigits: 3 }),
              },
            ]
          : []),
      ]}
      footer={
        <p className="mt-2 border-t border-[#E6F0F7] pt-2 text-[11px] leading-5 text-slate-600">
          {hasCost
            ? `متوسط التكلفة الحالي ${costLabel}`
            : 'لا يوجد متوسط تكلفة مسجّل لهذا الصنف.'}
        </p>
      }
    />
  );
}
