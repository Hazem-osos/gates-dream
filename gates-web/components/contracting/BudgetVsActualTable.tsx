'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import type { ProjectBudgetVsActual } from '@/lib/contracting/types';
import { cn } from '@/lib/utils';
import { formatEgp, formatQty, toMoney } from '@/lib/subcontracts/money';

export function BudgetVsActualTable({
  data,
  loading,
}: {
  data?: ProjectBudgetVsActual | null;
  loading?: boolean;
}) {
  if (loading) return <TableSkeleton rows={6} columns={8} />;
  const items = data?.items ?? [];
  if (!items.length) {
    return <EmptyState title="لا توجد مقارنة بعد" description="أضف بنود المقايسة وسجّل تكاليف فعلية لعرض الانحراف." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
      <table className="w-full min-w-[980px] text-center text-sm">
        <thead>
          <tr className="bg-[#0E78AA] text-white">
            <th className="px-3 py-2">البند</th>
            <th className="px-3 py-2">مخطط / منفّذ</th>
            <th className="px-3 py-2">تكلفة الوحدة مخطط</th>
            <th className="px-3 py-2">تكلفة الوحدة فعلي</th>
            <th className="px-3 py-2">انحراف التكلفة</th>
            <th className="px-3 py-2">خامات مخطط</th>
            <th className="px-3 py-2">خامات مصروفة</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const cv = toMoney(row.costVariance);
            const mv = toMoney(row.materials.variance);
            return (
              <tr key={row.projectBOQItemId} className="border-t border-slate-100 even:bg-[#F6FBFD]/40">
                <td className="px-3 py-2 text-start">
                  <p className="font-semibold text-[#094C6B]">{row.itemCode}</p>
                  <p className="text-xs text-slate-500">{row.descriptionAr}</p>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {formatQty(row.plannedQuantity)} / {formatQty(row.executedQuantity)}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatEgp(row.plannedUnitRate)}</td>
                <td className="px-3 py-2 tabular-nums">{row.actualUnitCost == null ? '—' : formatEgp(row.actualUnitCost)}</td>
                <td className={cn('px-3 py-2 tabular-nums font-semibold', cv >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                  {formatEgp(cv)}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatEgp(row.materials.plannedConsumed)}</td>
                <td className={cn('px-3 py-2 tabular-nums', mv >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                  {formatEgp(row.materials.actualConsumed)}
                </td>
              </tr>
            );
          })}
        </tbody>
        {data?.totals ? (
          <tfoot>
            <tr className="bg-[#F0F7FB] font-bold text-[#094C6B]">
              <td className="px-3 py-2">الإجمالي</td>
              <td className="px-3 py-2 tabular-nums">
                {formatQty(data.totals.plannedQuantity)} / {formatQty(data.totals.executedQuantity)}
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2 tabular-nums">{formatEgp(data.totals.costVariance)}</td>
              <td className="px-3 py-2 tabular-nums">{formatEgp(data.totals.plannedMaterials)}</td>
              <td className="px-3 py-2 tabular-nums">{formatEgp(data.totals.actualMaterials)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
