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
  StatusDotPill,
  DASH_PANEL,
  DASH_NUM,
  DASH_GRID,
} from '@/components/dashboard-primitives';

type ProductionOrder = {
  id: string;
  orderNumber?: string;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedQuantity?: number | string;
  actualQuantity?: number | string | null;
  totalMaterialCost?: number | string;
  unitCost?: number | string;
  finishedItem?: { arabicName?: string };
};

type BomRow = { id: string; name?: string; lines?: Array<{ rawItem?: { arabicName?: string; onHandQuantity?: number; lowerLimit?: number } }> };

const STAGE: Record<ProductionOrder['status'], string> = {
  DRAFT: 'مسودة',
  RELEASED: 'صرف خامات',
  IN_PROGRESS: 'تجميع',
  COMPLETED: 'تام',
  CANCELLED: 'ملغى',
};

export default function ManufacturingCommand() {
  useBackendReachability();
  const bomsQ = useApiQuery<BomRow[]>(['manufacturing-boms'], '/manufacturing/boms', undefined, { staleTime: staleTimes.masterMs });
  const ordersQ = useApiQuery<ProductionOrder[]>(['manufacturing-orders'], '/manufacturing/orders', undefined, {
    staleTime: staleTimes.transactionalMs,
  });
  const itemsQ = useApiQuery<Array<{ id: string; arabicName?: string; code?: string; onHandQuantity?: number; lowerLimit?: number; orderLimit?: number }>>(
    ['mfg-items'],
    '/inventory/items',
    { limit: 200, isActive: true },
    { staleTime: staleTimes.masterMs }
  );

  const orders = useMemo(() => ordersQ.data?.data ?? [], [ordersQ.data?.data]);
  const running = orders.filter((o) => o.status === 'IN_PROGRESS' || o.status === 'RELEASED');
  const drafts = orders.filter((o) => o.status === 'DRAFT');
  const completed = orders.filter((o) => o.status === 'COMPLETED');
  const items = itemsQ.data?.data ?? [];
  const shortages = items.filter((it) => {
    const qty = toFiniteNumber(it.onHandQuantity);
    const limit = toFiniteNumber(it.lowerLimit || it.orderLimit);
    return limit > 0 && qty <= limit;
  });
  const scrap = useMemo(() => {
    const pairs = orders.filter((o) => toFiniteNumber(o.plannedQuantity) > 0 && o.actualQuantity != null);
    if (!pairs.length) return 0;
    return (
      pairs.reduce((s, o) => {
        const plan = toFiniteNumber(o.plannedQuantity);
        const act = toFiniteNumber(o.actualQuantity);
        return s + ((act - plan) / plan) * 100;
      }, 0) / pairs.length
    );
  }, [orders]);

  return (
    <CommandCenter
      title="التصنيع والتجميع — أوامر التشغيل"
      module="MFG"
      refreshing={ordersQ.isFetching}
      onRefresh={() => {
        void ordersQ.refetch();
        void bomsQ.refetch();
      }}
      shortcuts={[
        { key: 'F2', label: 'أمر تشغيل', href: '/manufacturing/operations/operation' },
        { key: 'F4', label: 'BOM', href: '/manufacturing/creations/manufacturing-model' },
      ]}
    >
      <MetricBar
        loading={ordersQ.isLoading && !orders.length}
        items={[
          { id: 'run', label: 'أوامر نشطة', value: running.length, hint: `${orders.length} إجمالي` },
          { id: 'draft', label: 'بانتظار صرف خامات', value: drafts.length, tone: drafts.length ? 'warn' : 'ok' },
          { id: 'scrap', label: 'انحراف الهدر', value: `${scrap.toFixed(1)}٪`, tone: scrap > 0 ? 'bad' : 'ok' },
          { id: 'short', label: 'نواقص خامات', value: shortages.length, tone: shortages.length ? 'bad' : 'ok' },
          { id: 'bom', label: 'نماذج BOM', value: bomsQ.data?.data?.length ?? 0 },
          { id: 'fg', label: 'تكلفة التام', value: formatMoney(completed.reduce((s, o) => s + toFiniteNumber(o.unitCost) * toFiniteNumber(o.actualQuantity ?? o.plannedQuantity), 0)) },
        ]}
      />

      <div className={DASH_GRID}>
        <DataGridDense
          title="أوامر التشغيل النشطة"
          loading={ordersQ.isLoading}
          rows={running.concat(drafts).slice(0, 12)}
          onRowOpen={() => {
            window.location.href = '/manufacturing/operations/operation';
          }}
          columns={[
            { id: 'no', header: 'الأمر', cell: (r) => <span className={DASH_NUM}>{r.orderNumber ?? r.id.slice(0, 8)}</span> },
            {
              id: 'st',
              header: 'المرحلة',
              cell: (r) => {
                const tone =
                  r.status === 'COMPLETED'
                    ? 'success'
                    : r.status === 'IN_PROGRESS'
                      ? 'info'
                      : r.status === 'CANCELLED'
                        ? 'danger'
                        : 'warning';
                return <StatusDotPill label={STAGE[r.status]} tone={tone} />;
              },
            },
            {
              id: 'pct',
              header: '٪',
              numeric: true,
              cell: (r) => {
                const plan = toFiniteNumber(r.plannedQuantity);
                const act = toFiniteNumber(r.actualQuantity);
                return plan > 0 ? `${Math.round((act / plan) * 100)}٪` : '—';
              },
            },
            { id: 'qty', header: 'كمية', numeric: true, cell: (r) => String(r.plannedQuantity ?? '—') },
          ]}
        />
        <TriageQueue
          title="نواقص خامات التشغيل"
          items={shortages.slice(0, 12).map((it) => ({
            id: it.id,
            title: it.arabicName ?? it.code ?? it.id,
            meta: `رصيد ${toFiniteNumber(it.onHandQuantity)} ≤ حد ${toFiniteNumber(it.lowerLimit || it.orderLimit)}`,
            href: '/inventory/operations/purchase-order',
            tone: 'bad',
            actions: [{ label: 'أمر شراء', href: '/inventory/operations/purchase-order' }],
          }))}
        />
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">مسار الأوامر</p>
          <SegmentedBar
            segments={[
              { label: 'مسودة', value: drafts.length, color: '#94A3B8' },
              { label: 'صرف', value: orders.filter((o) => o.status === 'RELEASED').length, color: '#D97706' },
              { label: 'تشغيل', value: orders.filter((o) => o.status === 'IN_PROGRESS').length, color: '#0E79AA' },
              { label: 'تام', value: completed.length, color: '#059669' },
            ]}
          />
        </div>
      </div>
    </CommandCenter>
  );
}
