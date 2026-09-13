'use client';

import { Calculator, Layers, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { BoqStatusBadge } from '@/components/contracting/StatusBadges';
import { BOQ_UNIT_LABEL } from '@/lib/contracting/labels';
import type { OwnerBoqItem } from '@/lib/contracting/types';
import { formatEgp, formatPercent, formatQty, toMoney } from '@/lib/subcontracts/money';

export function OwnerBoqTable({
  items,
  loading,
  onAdd,
  onRateBreakdown,
  onMarkup,
  onMeasurements,
}: {
  items: OwnerBoqItem[];
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

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
      <table className="w-full min-w-[980px] text-center text-sm">
        <thead>
          <tr className="bg-[#0E78AA] text-white">
            <th className="px-3 py-2">كود البند</th>
            <th className="px-3 py-2">الوصف</th>
            <th className="px-3 py-2">الوحدة</th>
            <th className="px-3 py-2">كمية العقد</th>
            <th className="px-3 py-2">التكلفة المباشرة</th>
            <th className="px-3 py-2">نسبة التحميل</th>
            <th className="px-3 py-2">سعر البيع</th>
            <th className="px-3 py-2">إجمالي البند</th>
            <th className="px-3 py-2">المنفّذ التراكمي</th>
            <th className="px-3 py-2">الحالة</th>
            <th className="px-3 py-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-100 even:bg-[#F6FBFD]/50">
              <td className="px-3 py-2 font-semibold text-[#094C6B]">{item.itemCode}</td>
              <td className="px-3 py-2 text-start">{item.descriptionAr}</td>
              <td className="px-3 py-2">{BOQ_UNIT_LABEL[item.unit] ?? item.unit}</td>
              <td className="px-3 py-2 tabular-nums">{formatQty(item.contractQuantity)}</td>
              <td className="px-3 py-2 tabular-nums">{formatEgp(item.directCostEstimated)}</td>
              <td className="px-3 py-2 tabular-nums">{formatPercent(toMoney(item.indirectMarkupRate) * 100)}</td>
              <td className="px-3 py-2 tabular-nums">{formatEgp(item.unitSellingPrice)}</td>
              <td className="px-3 py-2 tabular-nums font-semibold">{formatEgp(item.totalSellingPrice)}</td>
              <td className="px-3 py-2 tabular-nums">{formatQty(item.cumulativeExecutedQty)}</td>
              <td className="px-3 py-2">
                <BoqStatusBadge status={item.status} />
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap justify-center gap-1">
                  <Button size="sm" variant="secondary" iconStart={<Layers className="h-3.5 w-3.5" />} onClick={() => onRateBreakdown(item)}>
                    تحليل السعر
                  </Button>
                  <Button size="sm" variant="secondary" iconStart={<Calculator className="h-3.5 w-3.5" />} onClick={() => onMarkup(item)}>
                    تحميل التكاليف
                  </Button>
                  <Button size="sm" variant="ghost" iconStart={<Ruler className="h-3.5 w-3.5" />} onClick={() => onMeasurements(item)}>
                    دفتر الحصر
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
