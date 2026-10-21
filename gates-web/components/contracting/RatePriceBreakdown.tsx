'use client';

import { ELEMENT_LABEL } from '@/lib/contracting/labels';
import { summarizeRateAnalysis } from '@/lib/contracting/rate-analysis-preview';
import type { RateAnalysisItem } from '@/lib/contracting/types';
import { formatEgp, formatPercent, formatQty, toMoney } from '@/lib/subcontracts/money';

export function RatePriceBreakdown({ items }: { items?: RateAnalysisItem[] }) {
  if (!items?.length) {
    return <span className="text-[11px] text-slate-400">لا يوجد تفصيل سعر</span>;
  }

  const summary = summarizeRateAnalysis(
    items.map((row) => ({
      costElementType: row.costElementType,
      totalCostPerUnit: toMoney(row.totalCostPerUnit),
    }))
  );
  const visible = summary.byType.filter((row) => row.total > 0);

  return (
    <div className="min-w-[280px] text-start text-[11px] leading-5">
      <table className="w-full">
        <thead>
          <tr className="text-slate-500">
            <th className="py-0.5 text-start font-medium">العنصر</th>
            <th className="py-0.5 text-start font-medium">البيان</th>
            <th className="py-0.5 font-medium">المعدل</th>
            <th className="py-0.5 font-medium">تكلفة الوحدة</th>
            <th className="py-0.5 font-medium">الهالك</th>
            <th className="py-0.5 font-medium">إجمالي السطر</th>
          </tr>
        </thead>
        <tbody>
          {items.map((line) => (
            <tr key={line.id || `${line.costElementType}-${line.descriptionAr}`} className="border-t border-slate-100">
              <td className="py-0.5 text-[#094C6B]">{ELEMENT_LABEL[line.costElementType]}</td>
              <td className="py-0.5">{line.descriptionAr}</td>
              <td className="py-0.5 text-center tabular-nums">{formatQty(line.consumptionQuotaPerUnit)}</td>
              <td className="py-0.5 text-center tabular-nums">{formatEgp(line.unitCost)}</td>
              <td className="py-0.5 text-center tabular-nums">{formatPercent(toMoney(line.wasteFactorRate) * 100)}</td>
              <td className="py-0.5 text-center tabular-nums">{formatEgp(line.totalCostPerUnit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 flex justify-between gap-3 border-t border-slate-200 pt-1 font-semibold text-[#094C6B]">
        <span>التكلفة المباشرة</span>
        <span className="tabular-nums">{formatEgp(summary.directUnitCost)}</span>
      </div>
      {visible.length === 0 ? null : (
        <p className="mt-1 text-slate-500">
          {visible.map((row) => `${ELEMENT_LABEL[row.costElementType]} ${formatEgp(row.total)}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
