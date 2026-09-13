'use client';

import { useEffect, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import { useItemCostAsOf } from '@/lib/hooks/useItemCostAsOf';
import { useItemStockBalance } from '@/lib/hooks/useItemStockBalance';
import type { InvoiceLineExtended } from '@/lib/invoices/invoiceLineColumns';

export type LineDetailDrawerLine = InvoiceLineExtended & {
  itemId?: string;
  unitId?: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  line: LineDetailDrawerLine | null;
  warehouseId?: string;
  variant: 'sales' | 'purchase';
  onSave: (patch: LineDetailDrawerLine) => void;
};

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';

export function LineItemDetailDrawer({
  open,
  onClose,
  title = 'تفاصيل السطر',
  line,
  warehouseId,
  variant,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<LineDetailDrawerLine>({});

  useEffect(() => {
    if (line) setDraft({ ...line });
  }, [line, open]);

  const { data: costRes } = useItemCostAsOf(draft.itemId ?? null);
  const {
    data: stockRes,
    isLoading: stockLoading,
    isError: stockError,
  } = useItemStockBalance(draft.itemId ?? null, warehouseId);
  const unitCost = Number(costRes?.data?.movingAverageCost ?? costRes?.data?.unitCost ?? 0);
  const availableQty = stockRes?.data?.availableQuantity;
  const warehouseLabel =
    stockRes?.data?.warehouseName ??
    (warehouseId ? `${warehouseId.slice(0, 8)}…` : '—');
  const qty = Number(draft.quantity ?? 0);
  const price = Number(draft.unitPrice ?? 0);
  const margin =
    price > 0 && unitCost > 0 ? (((price - unitCost) / price) * 100).toFixed(2) : '—';

  const patch = (key: keyof LineDetailDrawerLine, value: string | number | undefined) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="line-drawer-title">
        <div className="flex items-center justify-between border-b border-[#E6F0F7] px-5 py-4">
          <h2 id="line-drawer-title" className="text-lg font-bold text-[#0E78AA]">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-800">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-[#0A3D5E] mb-3">محاسبة وضرائب</h3>
            <div className="space-y-3">
              <label className="block text-xs text-gray-600">
                مركز تكلفة السطر
                <CostCenterSelect
                  value={draft.costCenterId ?? ''}
                  onChange={(v) => patch('costCenterId', v || undefined)}
                  className={inputCls}
                />
              </label>
              <label className="block text-xs text-gray-600">
                حساب {variant === 'sales' ? 'إيراد' : 'مصروف'} مخصص
                <input
                  className={inputCls}
                  placeholder="معرف الحساب (اختياري)"
                  value={draft.lineAccountId ?? ''}
                  onChange={(e) => patch('lineAccountId', e.target.value || undefined)}
                />
              </label>
              <label className="block text-xs text-gray-600">
                سبب الإعفاء الضريبي
                <input
                  className={inputCls}
                  value={draft.taxExemptionReason ?? ''}
                  onChange={(e) => patch('taxExemptionReason', e.target.value || undefined)}
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[#0A3D5E] mb-3">مخزون وتشغيلات</h3>
            <div className="space-y-3">
              <label className="block text-xs text-gray-600">
                رقم التشغيلة / الباتش
                <input
                  className={inputCls}
                  value={draft.batchNumber ?? ''}
                  onChange={(e) => patch('batchNumber', e.target.value || undefined)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-600">
                  تاريخ الإنتاج
                  <input
                    type="date"
                    className={inputCls}
                    value={draft.productionDate ?? ''}
                    onChange={(e) => patch('productionDate', e.target.value || undefined)}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  تاريخ الصلاحية
                  <input
                    type="date"
                    className={inputCls}
                    value={draft.expiryDate ?? ''}
                    onChange={(e) => patch('expiryDate', e.target.value || undefined)}
                  />
                </label>
              </div>
              <label className="block text-xs text-gray-600">
                أرقام سيريال (سطر لكل رقم)
                <textarea
                  className={`${inputCls} min-h-[72px]`}
                  value={draft.serialNumbers ?? ''}
                  onChange={(e) => patch('serialNumbers', e.target.value || undefined)}
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[#0A3D5E] mb-3">ملاحظات</h3>
            <textarea
              className={`${inputCls} min-h-[80px]`}
              placeholder="مواصفات تظهر على الفاتورة الرسمية"
              value={draft.lineNotes ?? ''}
              onChange={(e) => patch('lineNotes', e.target.value || undefined)}
            />
          </section>

          <section className="rounded-lg bg-[#F6FBFD] border border-[#E6F0F7] p-3 text-sm space-y-1">
            <div className="font-semibold text-[#0A3D5E]">حالة السطر</div>
            <div className="flex justify-between text-gray-600">
              <span>المخزن النشط</span>
              <span className="text-[#0A3D5E] font-medium">{warehouseLabel}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>الرصيد المتاح</span>
              <span className="text-[#0A3D5E] font-medium tabular-nums">
                {!warehouseId || !draft.itemId
                  ? '—'
                  : stockLoading
                    ? '…'
                    : stockError
                      ? 'تعذر التحميل'
                      : availableQty != null
                        ? availableQty.toLocaleString('ar-EG', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 3,
                          })
                        : '—'}
              </span>
            </div>
            {variant === 'sales' &&
            availableQty != null &&
            qty > availableQty &&
            !stockLoading ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                الكمية في السطر ({qty}) أكبر من الرصيد المتاح ({availableQty}).
              </p>
            ) : null}
            <div className="flex justify-between text-gray-600">
              <span>متوسط التكلفة</span>
              <span>{unitCost > 0 ? unitCost.toLocaleString('ar-EG') : '—'}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>هامش الربح التقريبي</span>
              <span>{margin === '—' ? '—' : `${margin}%`}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>قيمة السطر</span>
              <span>{(qty * price).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}</span>
            </div>
          </section>
        </div>

        <div className="border-t border-[#E6F0F7] p-4 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm">
            إلغاء
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-[#0E78AA] text-white text-sm font-medium"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            حفظ
          </button>
        </div>
    </CenteredOverlay>
  );
}
