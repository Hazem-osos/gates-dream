'use client';

import { previewBoqSellingLadder, type BoqSellingLadder } from '@/lib/contracting/rate-analysis-preview';
import type { BoqMarkupStructure } from '@/lib/contracting/types';
import { formatEgp, formatPercent, toMoney } from '@/lib/subcontracts/money';

function Row({
  label,
  rate,
  value,
  strong,
}: {
  label: string;
  rate?: number;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold text-[#094C6B]' : ''}`}>
      <span className={strong ? '' : 'text-slate-500'}>
        {label}
        {rate != null && rate > 0 ? ` ${formatPercent(rate * 100, 2)}` : ''}
      </span>
      <span className="tabular-nums">{formatEgp(value)}</span>
    </div>
  );
}

function LadderRows({ ladder, quantity, storedTotal }: { ladder: BoqSellingLadder; quantity: number; storedTotal?: number }) {
  const total = storedTotal != null ? storedTotal : ladder.unitSellingPrice * quantity;
  return (
    <div className="min-w-[240px] space-y-0.5 text-start text-[11px] leading-5">
      <Row label="التكلفة المباشرة" value={ladder.directUnitCost} strong />
      <Row label="مصاريف موقع" rate={ladder.siteOverheadRate} value={ladder.siteOverheadValue} />
      <Row label="مصاريف عمومية وإدارية" rate={ladder.generalOverheadRate} value={ladder.generalOverheadValue} />
      <Row label="احتياطي ومخاطر" rate={ladder.contingencyRiskRate} value={ladder.contingencyRiskValue} />
      <Row label="بعد المصاريف غير المباشرة" value={ladder.costWithOverhead} strong />
      <Row label="هامش الربح" rate={ladder.profitMarginRate} value={ladder.profitValue} />
      <Row label="بعد هامش الربح" value={ladder.priceAfterProfit} strong />
      <Row label="ضرائب تعاقدية" rate={ladder.contractTaxesRate} value={ladder.taxValue} />
      <Row label="سعر بيع الوحدة" value={ladder.unitSellingPrice} strong />
      <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-1 font-semibold text-[#0E78AA]">
        <span>إجمالي البند</span>
        <span className="tabular-nums">{formatEgp(total)}</span>
      </div>
    </div>
  );
}

export function BoqSellingLadder({
  directUnitCost,
  quantity,
  markup,
  indirectMarkupRate,
  storedUnitSellingPrice,
  storedTotalSellingPrice,
}: {
  directUnitCost: number;
  quantity: number;
  markup?: BoqMarkupStructure | null;
  indirectMarkupRate?: number;
  storedUnitSellingPrice?: number;
  storedTotalSellingPrice?: number;
}) {
  const direct = toMoney(directUnitCost);
  const qty = toMoney(quantity);

  if (markup) {
    const ladder = previewBoqSellingLadder(direct, {
      generalOverheadRate: toMoney(markup.generalOverheadRate),
      siteOverheadRate: toMoney(markup.siteOverheadRate),
      contingencyRiskRate: toMoney(markup.contingencyRiskRate),
      profitMarginRate: toMoney(markup.profitMarginRate),
      contractTaxesRate: toMoney(markup.contractTaxesRate),
    });
    const storedUnit = storedUnitSellingPrice == null ? null : toMoney(storedUnitSellingPrice);
    const drifted = storedUnit != null && Math.abs(storedUnit - ladder.unitSellingPrice) > 0.05;
    return (
      <div>
        <LadderRows
          ladder={drifted ? { ...ladder, unitSellingPrice: storedUnit } : ladder}
          quantity={qty}
          storedTotal={storedTotalSellingPrice == null ? undefined : toMoney(storedTotalSellingPrice)}
        />
        {drifted ? (
          <p className="mt-1 text-start text-[10px] text-slate-500">
            حسب النسب: {formatEgp(ladder.unitSellingPrice)} · المحفوظ: {formatEgp(storedUnit)}
          </p>
        ) : null}
      </div>
    );
  }

  const storedUnit = toMoney(storedUnitSellingPrice);
  const composite = toMoney(indirectMarkupRate);
  return (
    <div className="min-w-[220px] space-y-0.5 text-start text-[11px] leading-5">
      <Row label="التكلفة المباشرة" value={direct} strong />
      <Row label="نسبة التحميل" rate={composite} value={Math.max(0, storedUnit - direct)} />
      <Row label="سعر بيع الوحدة" value={storedUnit} strong />
      <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-1 font-semibold text-[#0E78AA]">
        <span>إجمالي البند</span>
        <span className="tabular-nums">{formatEgp(storedTotalSellingPrice)}</span>
      </div>
    </div>
  );
}
