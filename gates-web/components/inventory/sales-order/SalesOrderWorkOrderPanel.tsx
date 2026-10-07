'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { MfgTableCard, mfgTableScrollViewportClass } from '@/components/manufacturing/ManufacturingPageChrome';
import { erpInputClass, erpLabelClass } from '@/components/erp';
import { cn } from '@/lib/utils';

export type WorkOrderPanelLine = {
  itemId: string;
  itemName: string;
  quantity: number;
  specifications: string;
  imageUrl: string;
};

export type WorkOrderPanelData = {
  id: string;
  orderNumber: string;
  salesOrderNumber: string;
  workDate: string;
  deliveryLeadDays: number;
  expectedDeliveryDate: string;
  lines: WorkOrderPanelLine[];
};

type Props = {
  workOrder: WorkOrderPanelData | null;
  onLinesChange?: (lines: WorkOrderPanelLine[]) => void;
  disabled?: boolean;
};

export function SalesOrderWorkOrderPanel({ workOrder, onLinesChange, disabled }: Props) {
  const lines = workOrder?.lines ?? [];

  const header = useMemo(() => {
    if (!workOrder) return null;
    return workOrder;
  }, [workOrder]);

  if (!header) {
    return (
      <MfgTableCard title="أمر الشغل" scrollViewport>
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          احفظ أمر البيع ثم اضغط «إنشاء أمر شغل» لملء البيانات تلقائياً من الأمر.
        </p>
      </MfgTableCard>
    );
  }

  const patchLine = (index: number, patch: Partial<WorkOrderPanelLine>) => {
    if (!onLinesChange) return;
    onLinesChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  return (
    <MfgTableCard title="أمر الشغل" scrollViewport>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label className={erpLabelClass}>رقم أمر الشغل</label>
          <input className={erpInputClass} value={header.orderNumber} readOnly />
        </div>
        <div className="space-y-1">
          <label className={erpLabelClass}>رقم أمر البيع</label>
          <input className={erpInputClass} value={header.salesOrderNumber} readOnly />
        </div>
        <div className="space-y-1">
          <label className={erpLabelClass}>تاريخ أمر الشغل</label>
          <input className={erpInputClass} value={header.workDate} readOnly />
        </div>
        <div className="space-y-1">
          <label className={erpLabelClass}>مدة التسليم (يوم)</label>
          <input className={erpInputClass} value={String(header.deliveryLeadDays)} readOnly />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className={erpLabelClass}>تاريخ التسليم المتوقع</label>
          <input className={erpInputClass} value={header.expectedDeliveryDate} readOnly />
        </div>
        <div className="flex items-end sm:col-span-3">
          <Link
            href={`/manufacturing/operations/production-planning?id=${encodeURIComponent(header.id)}`}
            className="text-sm font-semibold text-[#0E78AA] underline-offset-2 hover:underline"
          >
            فتح أمر الشغل (نماذج التصنيع)
          </Link>
        </div>
      </div>

      <div className={cn(mfgTableScrollViewportClass, 'border-t border-[#E6F0F7]')}>
        <h3 className="px-4 pt-3 text-sm font-bold text-[#0A3D5E]">أصناف منتجة</h3>
        <table className="min-w-full text-right text-sm">
          <thead className="bg-[#0E78AA] text-xs font-semibold text-white">
            <tr>
              <th className="px-3 py-2">م</th>
              <th className="px-3 py-2">الصنف</th>
              <th className="px-3 py-2">الكمية المطلوبة</th>
              <th className="px-3 py-2">المواصفات</th>
              <th className="px-3 py-2">صورة الصنف</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  لا توجد أصناف منتجة
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <tr key={index} className="border-b border-[#EEF5F9]">
                  <td className="px-3 py-2 text-center text-slate-500">{index + 1}</td>
                  <td className="px-3 py-2 min-w-[180px]">
                    {onLinesChange && !disabled ? (
                      <ItemSelect
                        value={line.itemId}
                        onChange={(id) => patchLine(index, { itemId: id })}
                        onItemResolved={(item) => {
                          if (item) patchLine(index, { itemId: item.id, itemName: item.arabicName });
                        }}
                        className={erpInputClass}
                      />
                    ) : (
                      line.itemName || line.itemId
                    )}
                  </td>
                  <td className="px-3 py-2 w-28">
                    {onLinesChange && !disabled ? (
                      <input
                        type="number"
                        min={0}
                        className={erpInputClass}
                        value={line.quantity}
                        onChange={(e) =>
                          patchLine(index, { quantity: Number(e.target.value) || 0 })
                        }
                      />
                    ) : (
                      line.quantity
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {onLinesChange && !disabled ? (
                      <input
                        className={erpInputClass}
                        value={line.specifications}
                        onChange={(e) => patchLine(index, { specifications: e.target.value })}
                      />
                    ) : (
                      line.specifications || '—'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {line.imageUrl ? (
                      <img src={line.imageUrl} alt="" className="h-12 w-12 rounded border object-cover" />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </MfgTableCard>
  );
}
