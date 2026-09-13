'use client';

import { useItemQuickPeek } from '@/lib/hooks/useItemQuickPeek';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';

type Props = {
  open: boolean;
  onClose: () => void;
  itemId: string | null;
  itemLabel?: string;
  customerId?: string;
  unitPrice?: number;
};

function fmt(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ItemQuickPeekDrawer({
  open,
  onClose,
  itemId,
  itemLabel,
  customerId,
  unitPrice,
}: Props) {
  const { data: res, isLoading, isError } = useItemQuickPeek(itemId, {
    customerId,
    unitPrice,
    enabled: open && Boolean(itemId),
  });
  const peek = res?.data;

  return (
    <CenteredOverlay open={open} onClose={onClose} width="lg" labelledBy="item-peek-title">
        <header className="px-4 py-3 border-b border-[#D6EAF3] flex items-center justify-between bg-[#F6FBFD]">
          <div>
            <h2 id="item-peek-title" className="text-lg font-bold text-[#0E79AA]">فحص الصنف 360°</h2>
            <p className="text-sm text-gray-600">{itemLabel ?? peek?.itemName ?? '—'}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800 px-2">
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
          {isLoading && <p className="text-gray-500">جاري التحميل…</p>}
          {isError && <p className="text-red-600">تعذّر تحميل بيانات الصنف</p>}
          {peek && (
            <>
              <section>
                <h3 className="font-semibold text-[#0A3D5E] mb-2">المخزون حسب المستودعات</h3>
                {peek.warehouses.length === 0 ? (
                  <p className="text-gray-500">لا توجد كميات</p>
                ) : (
                  <ul className="space-y-1">
                    {peek.warehouses.map((w) => (
                      <li key={w.warehouseId} className="flex justify-between bg-[#F6FBFD] rounded px-2 py-1">
                        <span>
                          {w.warehouseName}
                          {w.branchName ? ` (${w.branchName})` : ''}
                        </span>
                        <span className="font-medium">{fmt(w.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {customerId && (
                <section>
                  <h3 className="font-semibold text-[#0A3D5E] mb-2">آخر 5 أسعار للعميل</h3>
                  {peek.customerPriceHistory.length === 0 ? (
                    <p className="text-gray-500">لا سجل سابق</p>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="py-1 text-right">التاريخ</th>
                          <th className="py-1 text-right">الفاتورة</th>
                          <th className="py-1 text-right">السعر</th>
                          <th className="py-1 text-right">الكمية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {peek.customerPriceHistory.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-1">{new Date(row.date).toLocaleDateString('ar-EG')}</td>
                            <td className="py-1">{row.invoiceNumber ?? '—'}</td>
                            <td className="py-1">{fmt(row.unitPrice)}</td>
                            <td className="py-1">{fmt(row.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              <section className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#E8F4FA] px-3 py-1 text-[#0E79AA]">
                  التكلفة ({peek.cost.costMethodLabel}): {fmt(peek.cost.unitCost)} ج.م
                </span>
                {peek.margin.sellingPrice > 0 && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
                    هامش الربح: {peek.margin.marginAmount >= 0 ? '+' : ''}
                    {fmt(peek.margin.marginAmount)} ج.م
                    {peek.margin.marginPct != null ? ` (${peek.margin.marginPct.toFixed(0)}%)` : ''}
                  </span>
                )}
              </section>

              <section>
                <h3 className="font-semibold text-[#0A3D5E] mb-2">حد الطلب / أوامر الشراء</h3>
                <p className="text-gray-700">
                  حد الطلب: {peek.reorder.orderLimit ?? '—'} | الحد الأدنى:{' '}
                  {peek.reorder.lowerLimit ?? '—'}
                </p>
                <p className="mt-1">
                  أوامر شراء معلقة: {fmt(peek.pendingPurchaseOrders.totalOpenQty)} وحدة
                </p>
              </section>
            </>
          )}
        </div>
        <footer className="px-4 py-2 border-t text-xs text-gray-500">اختصار: Alt+I على السطر</footer>
    </CenteredOverlay>
  );
}
