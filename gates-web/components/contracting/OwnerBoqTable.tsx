'use client';

import { Calculator, Layers, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { BoqSellingLadder } from '@/components/contracting/BoqSellingLadder';
import { RatePriceBreakdown } from '@/components/contracting/RatePriceBreakdown';
import { BoqStatusBadge } from '@/components/contracting/StatusBadges';
import { ownerBoqHierarchyHints, withItemCodeHierarchy } from '@/lib/contracting/boq-hierarchy';
import { BOQ_UNIT_LABEL } from '@/lib/contracting/labels';
import type { OwnerBoqItem } from '@/lib/contracting/types';
import type { ContractBoqScopeItem } from '@/lib/contracting/variation-types';
import { formatEgp, formatQty, toMoney } from '@/lib/subcontracts/money';

function isOwnerBoqHeader(item: OwnerBoqItem, dottedParent: boolean): boolean {
  if (item.hasChildren === true || item.isLeaf === false || item.isExecutable === false) return true;
  if (item.hasChildren === false || item.isLeaf === true) return false;
  return dottedParent;
}

export function OwnerBoqTable({
  items,
  scopeByItemId,
  loading,
  onAdd,
  onRateBreakdown,
  onMarkup,
  onMeasurements,
}: {
  items: OwnerBoqItem[];
  scopeByItemId?: Map<string, ContractBoqScopeItem>;
  loading?: boolean;
  onAdd?: () => void;
  onRateBreakdown: (item: OwnerBoqItem) => void;
  onMarkup: (item: OwnerBoqItem) => void;
  onMeasurements: (item: OwnerBoqItem) => void;
}) {
  if (loading) return <TableSkeleton rows={6} columns={8} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title="لا توجد بنود مقايسة تنفيذية"
        description="أضف بنود مقايسة المالك ثم حلّل السعر وحمّل التكاليف."
        action={
          onAdd ? (
            <Button size="sm" onClick={onAdd}>
              إضافة بند
            </Button>
          ) : undefined
        }
      />
    );
  }

  const rows = withItemCodeHierarchy(items, (item) => item.itemCode, ownerBoqHierarchyHints);
  const computedSelling = rows.reduce(
    (sum, item) =>
      isOwnerBoqHeader(item, item.__isParent) ? sum : sum + toMoney(item.totalSellingPrice),
    0
  );
  const apiLeafTotal = items[0]?.costStatus?.leafOnlyContractSellingTotal;
  const totalSelling = apiLeafTotal != null ? toMoney(apiLeafTotal) : computedSelling;
  const totalDirect = rows.reduce(
    (sum, item) =>
      isOwnerBoqHeader(item, item.__isParent)
        ? sum
        : sum + toMoney(item.directCostEstimated) * toMoney(item.contractQuantity),
    0
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
      <table className="w-full min-w-[1400px] text-center text-sm">
        <thead>
          <tr className="bg-[#0E78AA] text-white">
            <th className="px-3 py-2">كود البند</th>
            <th className="px-3 py-2">الوصف</th>
            <th className="px-3 py-2">الوحدة</th>
            <th className="px-3 py-2">كمية العقد</th>
            {scopeByItemId ? (
              <>
                <th className="px-3 py-2">أوامر معتمدة</th>
                <th className="px-3 py-2">الكمية الفعّالة</th>
              </>
            ) : null}
            <th className="px-3 py-2">التكلفة المباشرة</th>
            <th className="px-3 py-2">مسار السعر حتى البيع</th>
            <th className="px-3 py-2">سعر البيع</th>
            <th className="px-3 py-2">تفصيل السعر</th>
            <th className="px-3 py-2">إجمالي البند</th>
            <th className="px-3 py-2">المنفّذ التراكمي</th>
            <th className="px-3 py-2">الحالة</th>
            <th className="px-3 py-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const scope = scopeByItemId?.get(item.id);
            const isParent = isOwnerBoqHeader(item, item.__isParent);
            const pad = 8 + item.__depth * 16;
            return (
              <tr
                key={item.id}
                className={`border-t border-slate-100 ${
                  isParent ? 'bg-[#EEF6FA] font-semibold' : 'even:bg-[#F6FBFD]/50'
                }`}
              >
                <td className="px-3 py-2 text-start font-semibold text-[#094C6B]" style={{ paddingInlineStart: pad }}>
                  {item.itemCode}
                  {isParent ? (
                    <span className="mr-2 rounded bg-[#0E78AA]/10 px-1.5 py-0.5 text-[10px] font-normal text-[#0E78AA]">
                      بند رئيسي
                    </span>
                  ) : (
                    <span className="mr-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-normal text-emerald-800">
                      بند تنفيذي
                    </span>
                  )}
                  {scope?.origin === 'VARIATION_ORDER' && scope.sourceVariationOrderNumber ? (
                    <p className="text-[10px] font-normal text-emerald-800">
                      بند مضاف بأمر تغيير {scope.sourceVariationOrderNumber}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-start">
                  <p>{item.descriptionAr}</p>
                  {item.descriptionEn ? <p className="text-[11px] text-slate-500">{item.descriptionEn}</p> : null}
                  {item.notes ? <p className="text-[11px] text-slate-500">{item.notes}</p> : null}
                </td>
                <td className="px-3 py-2">{BOQ_UNIT_LABEL[item.unit] ?? item.unit}</td>
                <td className="px-3 py-2 tabular-nums">
                  {isParent ? '—' : formatQty(scope?.originalQuantity ?? item.contractQuantity)}
                </td>
                {scopeByItemId ? (
                  <>
                    <td className="px-3 py-2 tabular-nums">
                      {!isParent && scope && scope.approvedVariationQuantityDelta !== 0
                        ? formatQty(scope.approvedVariationQuantityDelta)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {isParent ? '—' : formatQty(scope?.effectiveQuantity ?? item.contractQuantity)}
                    </td>
                  </>
                ) : null}
                <td className="px-3 py-2 tabular-nums">
                  {isParent ? '—' : formatEgp(item.directCostEstimated)}
                </td>
                <td className="px-3 py-2">
                  {isParent ? (
                    '—'
                  ) : (
                    <BoqSellingLadder
                      directUnitCost={toMoney(item.directCostEstimated)}
                      quantity={toMoney(scope?.effectiveQuantity ?? item.contractQuantity)}
                      markup={item.markupStructures?.[0]}
                      indirectMarkupRate={toMoney(item.indirectMarkupRate)}
                      storedUnitSellingPrice={toMoney(item.unitSellingPrice)}
                      storedTotalSellingPrice={toMoney(item.totalSellingPrice)}
                    />
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {isParent ? '—' : formatEgp(item.unitSellingPrice)}
                </td>
                <td className="px-3 py-2">
                  {isParent ? (
                    <span className="text-xs text-slate-500">يُفصَّل على البنود التنفيذية</span>
                  ) : (
                    <RatePriceBreakdown items={item.rateAnalysisItems} />
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums font-semibold">
                  {isParent ? '—' : formatEgp(item.totalSellingPrice)}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {isParent ? '—' : formatQty(item.cumulativeExecutedQty)}
                </td>
                <td className="px-3 py-2">
                  <BoqStatusBadge status={item.status} />
                </td>
                <td className="px-3 py-2">
                  {isParent ? (
                    <span className="text-xs text-slate-500">يُسعَّر عبر البنود التنفيذية</span>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        iconStart={<Layers className="h-3.5 w-3.5" />}
                        onClick={() => onRateBreakdown(item)}
                      >
                        تحليل السعر
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        iconStart={<Calculator className="h-3.5 w-3.5" />}
                        onClick={() => onMarkup(item)}
                      >
                        تحميل التكاليف
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconStart={<Ruler className="h-3.5 w-3.5" />}
                        onClick={() => onMeasurements(item)}
                      >
                        دفتر الحصر
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#0E78AA] bg-[#F0F7FB] font-semibold">
            <td className="px-3 py-2 text-start" colSpan={scopeByItemId ? 6 : 4}>
              إجمالي البنود التنفيذية (بدون البنود الرئيسية)
            </td>
            <td className="px-3 py-2 tabular-nums">{formatEgp(totalDirect)}</td>
            <td />
            <td />
            <td />
            <td className="px-3 py-2 tabular-nums text-[#0E78AA]">{formatEgp(totalSelling)}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
