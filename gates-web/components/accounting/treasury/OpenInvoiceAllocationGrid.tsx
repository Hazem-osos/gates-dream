'use client';

import { useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { FormCard } from '@/components/ui';
import { erpInputClass, erpTableHeadCellClass, erpTableHeadRowClass } from '@/components/erp/erpUiTokens';
import { parseDecimal } from '@/lib/money/parseDecimal';

type InvoiceRow = {
  id: string;
  invoiceNumber?: string;
  netAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  customerId?: string;
  supplierId?: string;
  invoiceKind?: string;
};

type Props = {
  invoiceKind: 'SALE' | 'PURCHASE';
  partyId: string | undefined;
  partyField: 'customerId' | 'supplierId';
  onAllocatedChange: (total: number, rows: { invoiceId: string; amount: number }[]) => void;
};

export function OpenInvoiceAllocationGrid({
  invoiceKind,
  partyId,
  partyField,
  onAllocatedChange,
}: Props) {
  // Wave 5 fix: this used to fetch a flat top-100 posted-invoice list for the
  // whole company (no party filter) and narrow it to the selected party in
  // the browser, so a party's older open invoices could sit outside that
  // window and never show up. Filter by party and open balance server-side.
  const { data, isLoading } = useApiQuery<InvoiceRow[]>(
    ['open-invoices', invoiceKind, partyId ?? ''],
    '/invoices',
    {
      invoiceKind,
      isPosted: true,
      openOnly: true,
      limit: 200,
      [partyField]: partyId,
    },
    { enabled: !!partyId }
  );

  const invoices = useMemo(() => data?.data ?? [], [data?.data]);

  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const updateAllocation = (invoiceId: string, raw: string, maxOutstanding: number) => {
    let amount = parseDecimal(raw, NaN);
    if (raw.trim() === '') {
      amount = 0;
    } else if (!Number.isFinite(amount)) {
      amount = 0;
    } else {
      amount = Math.min(Math.max(0, amount), maxOutstanding);
    }
    const next = { ...allocations, [invoiceId]: raw.trim() === '' ? '' : String(amount) };
    setAllocations(next);
    const rows = Object.entries(next)
      .map(([id, v]) => ({ invoiceId: id, amount: parseDecimal(v) }))
      .filter((r) => r.amount > 0);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    onAllocatedChange(total, rows);
  };

  if (!partyId) {
    return (
      <FormCard title="توزيع على الفواتير المفتوحة" bodyClassName="p-4">
        <p className="text-sm text-slate-500 text-center py-4">اختر الطرف (عميل/مورد) لعرض الفواتير غير المسددة.</p>
      </FormCard>
    );
  }

  return (
    <FormCard title="توزيع على الفواتير المفتوحة" bodyClassName="p-3 mt-2">
      {isLoading ? (
        <p className="text-sm text-slate-500 py-4 text-center">جاري تحميل الفواتير…</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">لا توجد فواتير مفتوحة لهذا الطرف.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={erpTableHeadRowClass}>
                <th className={erpTableHeadCellClass}>رقم الفاتورة</th>
                <th className={erpTableHeadCellClass}>المتبقي</th>
                <th className={erpTableHeadCellClass}>المبلغ المخصص</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const outstanding =
                  inv.remainingAmount != null
                    ? parseDecimal(inv.remainingAmount)
                    : parseDecimal(inv.netAmount) - parseDecimal(inv.paidAmount);
                const label = inv.invoiceNumber || inv.id.slice(0, 8);
                return (
                  <tr key={inv.id} className="border-b border-slate-100">
                    <td className="py-2 px-2">{label}</td>
                    <td className="py-2 px-2 tabular-nums">{outstanding.toFixed(2)}</td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min={0}
                        max={outstanding}
                        step="0.01"
                        className={erpInputClass}
                        value={allocations[inv.id] ?? ''}
                        onChange={(e) => updateAllocation(inv.id, e.target.value, outstanding)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-2">خصص مبالغ على الفواتير غير المسددة؛ المجموع يظهر في الملخص المالي.</p>
    </FormCard>
  );
}
