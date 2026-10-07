'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { staleTimes } from '@/lib/query/query-keys';
import { formatMoney } from '@/lib/hooks/useExecutiveDashboard';
import { toFiniteNumber } from '@/components/dashboard';
import { StatusBadge } from '@/components/ui';
import { SegmentedBar } from '@/components/dashboard-primitives';
import {
  ManufacturingPageChrome,
  MfgEmptyRow,
  MfgMetric,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';

type ProductionOrder = {
  id: string;
  orderNumber?: string;
  status: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedQuantity?: number | string;
  actualQuantity?: number | string | null;
  unitCost?: number | string;
};

const STAGE: Record<ProductionOrder['status'], string> = {
  DRAFT: 'تم التأكيد',
  RELEASED: 'تم التأكيد',
  IN_PROGRESS: 'قيد التنفيذ',
  COMPLETED: 'منتهي',
  CANCELLED: 'ملغى',
};

function stageTone(status: ProductionOrder['status']) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'IN_PROGRESS' || status === 'RELEASED') return 'info' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'warning' as const;
}

export default function ManufacturingCommand() {
  useBackendReachability();
  const router = useRouter();
  const bomsQ = useApiQuery<{ id: string }[]>(['manufacturing-boms'], '/manufacturing/boms', undefined, {
    staleTime: staleTimes.masterMs,
  });
  const ordersQ = useApiQuery<ProductionOrder[]>(['manufacturing-orders'], '/manufacturing/orders', undefined, {
    staleTime: staleTimes.transactionalMs,
  });
  const itemsQ = useApiQuery<
    Array<{ id: string; arabicName?: string; code?: string; onHandQuantity?: number; lowerLimit?: number; orderLimit?: number }>
  >(['mfg-items'], '/inventory/items', { limit: 200, isActive: true }, { staleTime: staleTimes.masterMs });

  const orders = useMemo(() => ordersQ.data?.data ?? [], [ordersQ.data?.data]);
  const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS');
  const confirmed = orders.filter((o) => o.status === 'RELEASED' || o.status === 'DRAFT');
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

  const activeRows = inProgress.concat(confirmed).slice(0, 12);

  return (
    <ManufacturingPageChrome
      title="التصنيع والإنتاج"
      statusLabel="تشغيل"
      favoriteHref="/manufacturing"
      hideSave
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MfgMetric label="قيد التنفيذ" value={inProgress.length} hint={`${orders.length} إجمالي`} />
        <MfgMetric label="تم التأكيد" value={confirmed.length} tone={confirmed.length ? 'warn' : 'ok'} />
        <MfgMetric label="انحراف الهدر" value={`${scrap.toLocaleString()}٪`} tone={scrap > 0 ? 'bad' : 'ok'} />
        <MfgMetric label="نواقص خامات" value={shortages.length} tone={shortages.length ? 'bad' : 'ok'} />
        <MfgMetric label="نماذج BOM" value={bomsQ.data?.data?.length ?? 0} />
        <MfgMetric
          label="تكلفة التام"
          value={formatMoney(
            completed.reduce(
              (s, o) => s + toFiniteNumber(o.unitCost) * toFiniteNumber(o.actualQuantity ?? o.plannedQuantity),
              0
            )
          )}
        />
      </div>

      <div className="rounded-2xl border border-[#D6EAF3] bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-[#094C6B]">توزيع أوامر التشغيل</p>
        <SegmentedBar
          segments={[
            { label: 'مسودة', value: confirmed.length, color: '#E3A008' },
            { label: 'قيد التشغيل', value: inProgress.length, color: '#0E78AA' },
            { label: 'تام', value: completed.length, color: '#059669' },
            { label: 'ملغى', value: orders.filter((o) => o.status === 'CANCELLED').length, color: '#94A3B8' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MfgTableCard title="أوامر التشغيل النشطة">
          <table className={mfgTableClass}>
            <thead className={mfgTheadClass}>
              <tr>
                <th className={mfgThClass}>الأمر</th>
                <th className={mfgThClass}>المرحلة</th>
                <th className={`${mfgThClass} text-left`}>٪</th>
                <th className={`${mfgThClass} text-left`}>الكمية</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 ? (
                <MfgEmptyRow colSpan={4}>لا توجد أوامر تشغيل نشطة</MfgEmptyRow>
              ) : (
                activeRows.map((row) => {
                  const plan = toFiniteNumber(row.plannedQuantity);
                  const act = toFiniteNumber(row.actualQuantity);
                  return (
                    <tr
                      key={row.id}
                      className={`${mfgTrClass} cursor-pointer`}
                      onClick={() => router.push('/manufacturing/operations/operation')}
                    >
                      <td className={`${mfgTdClass} font-mono font-semibold`}>{row.orderNumber ?? row.id.slice(0, 8)}</td>
                      <td className={mfgTdClass}>
                        <StatusBadge compact label={STAGE[row.status]} tone={stageTone(row.status)} />
                      </td>
                      <td className={`${mfgTdClass} text-left tabular-nums`}>
                        {plan > 0 ? `${Math.round((act / plan) * 100)}٪` : '—'}
                      </td>
                      <td className={`${mfgTdClass} text-left tabular-nums`}>{String(row.plannedQuantity ?? '—')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </MfgTableCard>

        <MfgTableCard title="نواقص خامات التشغيل">
          <table className={mfgTableClass}>
            <thead className={mfgTheadClass}>
              <tr>
                <th className={mfgThClass}>الصنف</th>
                <th className={mfgThClass}>الرصيد / الحد</th>
              </tr>
            </thead>
            <tbody>
              {shortages.length === 0 ? (
                <MfgEmptyRow colSpan={2}>لا توجد نواقص خامات</MfgEmptyRow>
              ) : (
                shortages.slice(0, 12).map((it) => (
                  <tr
                    key={it.id}
                    className={`${mfgTrClass} cursor-pointer`}
                    onClick={() => router.push('/inventory/operations/purchase-order')}
                  >
                    <td className={mfgTdClass}>{it.arabicName ?? it.code ?? it.id}</td>
                    <td className={`${mfgTdClass} text-rose-700`}>
                      رصيد {toFiniteNumber(it.onHandQuantity)} ≤ حد {toFiniteNumber(it.lowerLimit || it.orderLimit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </MfgTableCard>
      </div>
    </ManufacturingPageChrome>
  );
}
