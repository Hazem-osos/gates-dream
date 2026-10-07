'use client';

import { useState } from 'react';
import { Button, Switch } from '@/components/ui';
import { useItemStockBalance } from '@/lib/hooks/useItemStockBalance';
import type { ProcessRawRow } from '@/lib/manufacturing/process-from-bom';
import { ItemAlternativesPeek } from '@/components/manufacturing/ItemAlternativesPeek';

type Props = {
  open: boolean;
  onClose: () => void;
  rows: ProcessRawRow[];
  defaultWarehouseId: string;
  onTransferShortages?: () => void;
  transferShortagesPending?: boolean;
};

function CheckRow({
  row,
  warehouseId,
}: {
  row: ProcessRawRow;
  warehouseId: string;
}) {
  const wh = row.warehouseId || warehouseId;
  const { data } = useItemStockBalance(row.itemId, wh || null);
  const balance = Number(data?.data?.availableQuantity ?? data?.data?.quantityOnHand ?? 0);
  const required = row.quantity;
  const shortage = Math.max(0, required - (Number.isFinite(balance) ? balance : 0));

  return (
    <tr className="border-b border-[#EEF5F9]">
      <td className="px-3 py-2 text-sm text-[#0A3D5E]">
        <div className="flex min-w-0 items-center justify-end gap-1">
          <span className="min-w-0 truncate">{row.itemName}</span>
          <ItemAlternativesPeek itemId={row.itemId} />
        </div>
      </td>
      <td className="px-3 py-2 tabular-nums text-sm">{required.toLocaleString('ar-EG')}</td>
      <td className="px-3 py-2 tabular-nums text-sm">
        {Number.isFinite(balance) ? balance.toLocaleString('ar-EG') : '—'}
      </td>
      <td
        className={`px-3 py-2 tabular-nums text-sm font-semibold ${shortage > 0 ? 'text-rose-600' : 'text-emerald-700'}`}
      >
        {shortage.toLocaleString('ar-EG')}
      </td>
    </tr>
  );
}

export function ManufacturingQuantityCheckDialog({
  open,
  onClose,
  rows,
  defaultWarehouseId,
  onTransferShortages,
  transferShortagesPending,
}: Props) {
  const [shortageOnly, setShortageOnly] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E6F0F7] bg-[#F8FBFD] px-4 py-3">
          <h2 className="text-base font-bold text-[#0A3D5E]">فحص الكميات — خامات أولية</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>
        <div className="border-b border-[#EEF5F9] px-4 py-2">
          <Switch label="عرض الأصناف الناقصة فقط" checked={shortageOnly} onCheckedChange={setShortageOnly} />
          <p className="mt-1 text-xs text-slate-500">
            الكمية = من النموذج × عدد النماذج. الرصيد من مخزن كل خامة كما في نموذج التصنيع (أو مخزن النموذج الافتراضي).
          </p>
        </div>
        <div className="max-h-[55vh] overflow-auto">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-[#F4F9FC] text-xs font-bold text-[#0A3D5E]">
              <tr>
                <th className="px-3 py-2">الصنف</th>
                <th className="px-3 py-2">الكمية المطلوبة</th>
                <th className="px-3 py-2">رصيد المخزن</th>
                <th className="px-3 py-2">العجز</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    لا توجد خامات للفحص — اضغط «تحميل» من النموذج أولاً
                  </td>
                </tr>
              ) : shortageOnly ? (
                rows.map((row) => (
                  <ShortageFilterRow key={row.itemId + row.warehouseId} row={row} warehouseId={defaultWarehouseId} />
                ))
              ) : (
                rows.map((row) => (
                  <CheckRow key={row.itemId + row.warehouseId} row={row} warehouseId={defaultWarehouseId} />
                ))
              )}
            </tbody>
          </table>
        </div>
        {onTransferShortages ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF5F9] px-4 py-3">
            <p className="text-xs text-slate-500">
              «نقل العجز» يفتح تحويل مخزني بكميات النقص فقط (من مخزن المصدر إلى مخزن الوجهة).
            </p>
            <Button
              type="button"
              size="sm"
              disabled={transferShortagesPending || rows.length === 0}
              onClick={onTransferShortages}
            >
              {transferShortagesPending ? 'جاري الحساب…' : 'نقل العجز إلى التحويل المخزني'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ShortageFilterRow({ row, warehouseId }: { row: ProcessRawRow; warehouseId: string }) {
  const wh = row.warehouseId || warehouseId;
  const { data } = useItemStockBalance(row.itemId, wh || null);
  const balance = Number(data?.data?.availableQuantity ?? data?.data?.quantityOnHand ?? 0);
  const shortage = Math.max(0, row.quantity - (Number.isFinite(balance) ? balance : 0));
  if (shortage <= 0.0001) return null;
  return (
    <tr className="border-b border-[#EEF5F9]">
      <td className="px-3 py-2 text-sm">
        <div className="flex min-w-0 items-center justify-end gap-1">
          <span className="min-w-0 truncate">{row.itemName}</span>
          <ItemAlternativesPeek itemId={row.itemId} />
        </div>
      </td>
      <td className="px-3 py-2 tabular-nums text-sm">{row.quantity.toLocaleString('ar-EG')}</td>
      <td className="px-3 py-2 tabular-nums text-sm">{balance.toLocaleString('ar-EG')}</td>
      <td className="px-3 py-2 tabular-nums text-sm font-semibold text-rose-600">
        {shortage.toLocaleString('ar-EG')}
      </td>
    </tr>
  );
}
