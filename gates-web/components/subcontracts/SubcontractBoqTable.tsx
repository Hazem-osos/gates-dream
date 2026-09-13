'use client';

import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { formatEgp, formatPercent, formatQty, toMoney } from '@/lib/subcontracts/money';
import type { SubcontractBoqItem } from '@/lib/subcontracts/types';

function progressPercent(item: SubcontractBoqItem): number {
  const contract = toMoney(item.contractQuantity);
  if (contract <= 0) return 0;
  const raw = item.completionPercentage != null ? toMoney(item.completionPercentage) : (toMoney(item.cumulativeExecutedQty) / contract) * 100;
  return Math.max(0, Math.min(raw, 999));
}

export function SubcontractBoqTable({
  items,
  onImport,
}: {
  items: SubcontractBoqItem[];
  onImport?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#0E79AA]">جدول الكميات وتنفيذ البنود</h2>
        {onImport ? (
          <Button size="sm" onClick={onImport}>
            إضافة / استيراد بنود BOQ
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="لا توجد بنود مقايسة"
          description="أضف بنود الأعمال بالعقد قبل إنشاء أول مستخلص."
          action={
            onImport ? (
              <Button size="sm" onClick={onImport}>
                إضافة بنود
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
          <table className="w-full min-w-[980px] text-center text-sm">
            <thead>
              <tr className="bg-[#0E78AA] text-white">
                <th className="px-3 py-3 font-semibold">كود البند</th>
                <th className="px-3 py-3 font-semibold">الوصف</th>
                <th className="px-3 py-3 font-semibold">الوحدة</th>
                <th className="px-3 py-3 font-semibold">كمية العقد</th>
                <th className="px-3 py-3 font-semibold">سعر الوحدة</th>
                <th className="px-3 py-3 font-semibold">الإجمالي</th>
                <th className="px-3 py-3 font-semibold">المنفذ تراكميًا</th>
                <th className="px-3 py-3 font-semibold">نسبة الإنجاز</th>
                <th className="px-3 py-3 font-semibold">المتبقي</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const remaining = toMoney(item.contractQuantity) - toMoney(item.cumulativeExecutedQty);
                const pct = progressPercent(item);
                const max = toMoney(item.maxAllowedQuantity);
                const executed = toMoney(item.cumulativeExecutedQty);
                const warn = max > 0 && executed / max >= 0.9;
                return (
                  <tr key={item.id} className={index % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                    <td className="px-3 py-3 font-semibold text-[#094C6B]">{item.itemCode}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-medium text-[#094C6B]">{item.descriptionAr}</div>
                      {item.descriptionEn ? (
                        <div className="text-xs text-slate-500" dir="ltr">
                          {item.descriptionEn}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{item.unit}</td>
                    <td className="px-3 py-3 tabular-nums">{formatQty(item.contractQuantity)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatEgp(item.unitPrice)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatEgp(item.totalPrice)}</td>
                    <td className="px-3 py-3">
                      <div className="tabular-nums">{formatQty(item.cumulativeExecutedQty)}</div>
                      {warn ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          يقترب من الحد الأقصى
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="mx-auto h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={warn ? 'h-full bg-red-500' : 'h-full bg-[#0E79AA]'}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs tabular-nums text-slate-600">{formatPercent(pct)}</div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatQty(Math.max(0, remaining))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
