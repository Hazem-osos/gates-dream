'use client';

import { useMemo } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { staleTimes } from '@/lib/query/query-keys';
import { formatMoney } from '@/lib/hooks/useExecutiveDashboard';
import { toFiniteNumber } from '@/components/dashboard';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  DASH_PANEL,
  DASH_NUM,
  DASH_GRID,
} from '@/components/dashboard-primitives';

type ItemRow = {
  id: string;
  arabicName?: string;
  code?: string | null;
  onHandQuantity?: number | string | null;
  salesPrice?: number | string | null;
  reorderPoint?: number | string | null;
  lowerLimit?: number | string | null;
  orderLimit?: number | string | null;
  useExpirationDate?: boolean;
  itemGroup?: { arabicName?: string } | null;
};

type StockDoc = { id: string; serialNumber?: string | null; date?: string; isPosted?: boolean; kind?: string };

export default function InventoryCommand() {
  useBackendReachability();
  const itemsQ = useApiQuery<ItemRow[]>(['inventory-hub-items'], '/inventory/items', { limit: 200, isActive: true }, { staleTime: staleTimes.masterMs });
  const receiptsQ = useApiQuery<StockDoc[]>(['inv-rcpt'], '/inventory/receipts', { limit: 20, page: 1 }, { staleTime: staleTimes.transactionalMs });
  const issuesQ = useApiQuery<StockDoc[]>(['inv-iss'], '/inventory/issues', { limit: 20, page: 1 }, { staleTime: staleTimes.transactionalMs });
  const transfersQ = useApiQuery<StockDoc[]>(['inv-tr'], '/inventory/transfers', { limit: 20, page: 1 }, { staleTime: staleTimes.transactionalMs });

  const items = useMemo(() => itemsQ.data?.data ?? [], [itemsQ.data?.data]);
  const stockValue = items.reduce((s, it) => s + toFiniteNumber(it.onHandQuantity) * toFiniteNumber(it.salesPrice), 0);
  const reorder = items.filter((it) => {
    const qty = toFiniteNumber(it.onHandQuantity);
    const limit = toFiniteNumber(it.orderLimit || it.lowerLimit || it.reorderPoint);
    return limit > 0 && qty <= limit;
  });
  const zero = items.filter((it) => toFiniteNumber(it.onHandQuantity) <= 0);
  const dead = items.filter((it) => toFiniteNumber(it.onHandQuantity) > 0 && toFiniteNumber(it.salesPrice) <= 0);
  const expiryWatch = items.filter((it) => it.useExpirationDate);

  const slices = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const key = it.itemGroup?.arabicName || 'غير مصنّف';
      map.set(key, (map.get(key) ?? 0) + toFiniteNumber(it.onHandQuantity) * toFiniteNumber(it.salesPrice));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [items]);

  return (
    <CommandCenter
      title="المخزون — حد الطلب والراكد"
      module="INVENTORY"
      refreshing={itemsQ.isFetching}
      onRefresh={() => void itemsQ.refetch()}
      shortcuts={[
        { key: 'F2', label: 'صرف', href: '/inventory/operations/issue' },
        { key: 'F4', label: 'إضافة', href: '/inventory/operations/receipt' },
        { key: 'F6', label: 'تحويل', href: '/inventory/operations/transfer' },
      ]}
    >
      <MetricBar
        loading={itemsQ.isLoading && !items.length}
        items={[
          { id: 'val', label: 'قيمة المخزون', value: formatMoney(stockValue), hint: `${items.length} صنف` },
          { id: 'ro', label: 'تجاوز حد الطلب', value: reorder.length, tone: reorder.length ? 'bad' : 'ok' },
          { id: 'z', label: 'نفد الرصيد', value: zero.length, tone: zero.length ? 'bad' : 'ok' },
          { id: 'dead', label: 'راكد / بدون سعر', value: dead.length, tone: dead.length ? 'warn' : 'ok' },
          { id: 'exp', label: 'أصناف بتاريخ صلاحية', value: expiryWatch.length },
          { id: 'mv', label: 'حركات حديثة', value: (receiptsQ.data?.data?.length ?? 0) + (issuesQ.data?.data?.length ?? 0) },
        ]}
      />

      <div className={DASH_GRID}>
        <TriageQueue
          title="رادار إعادة الطلب"
          items={reorder.slice(0, 14).map((it) => ({
            id: it.id,
            title: it.arabicName ?? it.code ?? it.id,
            meta: `رصيد ${toFiniteNumber(it.onHandQuantity)} · حد ${toFiniteNumber(it.orderLimit || it.lowerLimit)}`,
            tone: toFiniteNumber(it.onHandQuantity) <= 0 ? 'bad' : 'warn',
            actions: [{ label: 'إنشاء أمر شراء', href: '/inventory/operations/purchase-order' }],
          }))}
        />
        <DataGridDense
          title="رأس مال محبوس — راكد"
          loading={itemsQ.isLoading}
          rows={dead.slice(0, 12)}
          emptyActionHref="/inventory/creations/item-card"
          emptyActionLabel="بطاقة صنف"
          columns={[
            { id: 'c', header: 'الكود', cell: (r) => <span className={DASH_NUM}>{r.code ?? r.id.slice(0, 6)}</span> },
            { id: 'n', header: 'الصنف', cell: (r) => r.arabicName ?? '—' },
            { id: 'q', header: 'رصيد', numeric: true, cell: (r) => String(toFiniteNumber(r.onHandQuantity)) },
          ]}
        />
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">توزيع القيمة</p>
          <SegmentedBar
            segments={slices.map((s, i) => ({
              label: s[0],
              value: s[1],
              color: ['#0E79AA', '#059669', '#D97706', '#0284C7', '#64748B'][i] ?? '#94A3B8',
            }))}
          />
          <p className="mt-3 text-[10px] text-slate-500">
            صلاحية التشغيلات تُدار على سطر الفاتورة (`expiryDate` / `batchNumber`) — لا يوجد دفتر تشغيلات مستقل.
          </p>
          <TriageQueue
            title="تحويلات غير مرحلة"
            items={(transfersQ.data?.data ?? [])
              .filter((t) => !t.isPosted)
              .slice(0, 6)
              .map((t) => ({
                id: t.id,
                title: t.serialNumber ?? t.id.slice(0, 8),
                href: '/inventory/operations/transfer',
                tone: 'warn',
              }))}
          />
        </div>
      </div>
    </CommandCenter>
  );
}
