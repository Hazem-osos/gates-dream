'use client';

import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { FormSectionCard } from '@/components/ui';
import { AppTable } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';

export type ItemReservationRow = {
  id: string;
  warehouseId: string;
  itemId: string;
  customerId?: string | null;
  quantity: number;
  fulfilledQuantity: number;
  remainingQuantity: number;
  reason: string;
  status: string;
  issueStatusLabel: string;
  itemName: string;
  itemSerial?: string;
  warehouseName: string;
};

export type ApplyReservationPayload = {
  reservation: ItemReservationRow;
  quantity: number;
};

type Props = {
  warehouseId?: string;
  customerId?: string;
  disabled?: boolean;
  onApply: (payload: ApplyReservationPayload) => void;
};

function formatQty(value: number): string {
  return value.toLocaleString('ar-EG', { maximumFractionDigits: 4 });
}

export function ItemReservationDocumentPanel({
  warehouseId,
  customerId,
  disabled,
  onApply,
}: Props) {
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});

  const listParams = useMemo(
    () => ({
      warehouseId: warehouseId || undefined,
      customerId: customerId || undefined,
      status: 'OPEN',
      limit: 50,
    }),
    [warehouseId, customerId]
  );

  const listEnabled = Boolean(warehouseId) || Boolean(customerId);

  const listQuery = useApiQuery<ItemReservationRow[]>(
    queryKeys.itemReservations(listParams),
    '/inventory/item-reservations',
    listParams,
    { enabled: listEnabled }
  );

  const rows = Array.isArray(listQuery.data?.data) ? listQuery.data.data : [];

  return (
    <FormSectionCard
      title="حجوزات الأصناف"
      subtitle="اختر حجزاً لسحب كميته إلى السند. عند الترحيل يتحدّث الحجز: لم يُصرف / جزئي / تم الصرف."
      icon={Lock}
      bodyClassName="space-y-3"
    >
      {!listEnabled ? (
        <p className="text-sm text-slate-600">
          {customerId ? 'لا توجد حجوزات مفتوحة لهذا العميل.' : 'اختر المخزن أو العميل لعرض الحجوزات.'}
        </p>
      ) : (
        <AppTable<ItemReservationRow>
          isLoading={listQuery.isLoading}
          data={rows}
          getRowKey={(row) => row.id}
          emptyTitle="لا توجد حجوزات مفتوحة"
          emptyDescription="يمكنك إنشاء حجز من شاشة حجز الأصناف، أو من هنا بعد اختيار صنف."
          columns={[
            {
              id: 'item',
              header: 'الصنف',
              cell: (row) =>
                row.itemSerial ? `${row.itemSerial} — ${row.itemName}` : row.itemName,
            },
            {
              id: 'qty',
              header: 'محجوز / متبقي',
              align: 'center',
              cell: (row) => (
                <span className="tabular-nums">
                  {formatQty(row.quantity)} / {formatQty(row.remainingQuantity)}
                </span>
              ),
            },
            {
              id: 'status',
              header: 'حالة الصرف',
              cell: (row) => row.issueStatusLabel,
            },
            {
              id: 'reason',
              header: 'السبب',
              cell: (row) => row.reason,
            },
            {
              id: 'apply',
              header: 'إضافة للسند',
              cell: (row) => {
                const max = row.remainingQuantity;
                const raw = draftQty[row.id] ?? String(max);
                return (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <input
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-end text-sm tabular-nums"
                      inputMode="decimal"
                      disabled={disabled || max <= 0}
                      value={raw}
                      onChange={(e) =>
                        setDraftQty((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      disabled={disabled || max <= 0}
                      className="rounded-lg bg-brand px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                      onClick={() => {
                        const n = parseFloat(String(raw).replace(/,/g, ''));
                        const qty = Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : max;
                        if (!(qty > 0)) return;
                        onApply({ reservation: row, quantity: qty });
                      }}
                    >
                      إضافة
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      )}
    </FormSectionCard>
  );
}
