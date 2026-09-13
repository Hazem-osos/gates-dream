'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/real-estate/format';
import { toHijri } from '@/lib/dates/hijri';
import type { RealEstateInvestmentDashboardSummary } from '@/lib/dashboards/types';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  StackingMatrix,
  GaugeBar,
  SegmentedBar,
  DASH_PANEL,
  DASH_NUM,
  type StackingUnit,
  type StackingBuilding,
} from '@/components/dashboard-primitives';

function hoursLeft(iso?: string | null): string {
  if (!iso) return '—';
  const hrs = Math.round((Date.parse(iso) - Date.now()) / 36e5);
  if (Number.isNaN(hrs)) return '—';
  if (hrs <= 0) return 'منتهٍ';
  if (hrs < 24) return `${hrs}س`;
  return `${Math.round(hrs / 24)}ي`;
}

export default function RealEstateInvestmentCommandCenter() {
  const { data, isLoading, isFetching, refetch } = useApiQuery<RealEstateInvestmentDashboardSummary>(
    queryKeys.realEstate.investmentDashboard(),
    '/real-estate/investment-dashboard/summary',
    undefined,
    { staleTime: staleTimes.transactionalMs, requireFullTenant: false }
  );
  const summary = data?.data;
  const k = summary?.kpis;
  const [drawer, setDrawer] = useState<{ unit: StackingUnit; building: StackingBuilding } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const spark = (summary?.charts.monthlyReservations ?? []).map((m) => m.reserved);

  const runAction = async (id: string, path: string) => {
    setBusy(id);
    try {
      await apiClient.post(path, path.endsWith('/extend') ? { days: 7 } : { reason: 'تحرير من لوحة الاستثمار' });
      await refetch();
    } finally {
      setBusy(null);
    }
  };

  const occupancy = k?.unitsTotal ? Math.round((k.unitsSold / k.unitsTotal) * 100) : 0;

  const drawerActions = useMemo(() => {
    const res = drawer?.unit.reservation;
    if (!res) return null;
    return res;
  }, [drawer]);

  return (
    <CommandCenter
      title="الاستثمار العقاري — مركز العمليات"
      module="REAL ESTATE"
      asOf={summary?.asOfDate}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'حجز', href: '/real-estate-investment/operations/reservation' },
        { key: 'F4', label: 'وحدة', href: '/real-estate-investment/create/unit-sale-others' },
        { key: 'F6', label: 'محفظة', href: '/real-estate' },
      ]}
    >
      <MetricBar
        loading={isLoading && !summary}
        items={[
          {
            id: 'avail',
            label: 'مخزون متاح',
            value: <SensitiveValue>{formatEgp(k?.availableInventoryValue)}</SensitiveValue>,
            hint: `${k?.unitsAvailable ?? 0} وحدة · ${k?.projects ?? 0} مشروع`,
            spark,
          },
          {
            id: 'res',
            label: 'حجوزات مفتوحة',
            value: k?.openReservations ?? 0,
            hint: <SensitiveValue>{formatEgp(k?.openReservationValue)}</SensitiveValue>,
            tone: (k?.expiringReservations ?? 0) > 0 ? 'warn' : 'ok',
          },
          {
            id: '48h',
            label: 'ينتهي ≤ 48س',
            value: summary?.expiring48h.length ?? 0,
            tone: (summary?.expiring48h.length ?? 0) > 0 ? 'bad' : 'ok',
          },
          {
            id: 'week',
            label: 'تحصيلات الأسبوع',
            value: <SensitiveValue>{formatEgp(summary?.collectionGauge.weekDue)}</SensitiveValue>,
            hint: `${summary?.weekInstallments.length ?? 0} قسط`,
          },
          {
            id: 'sold',
            label: 'نسبة البيع',
            value: `${occupancy}٪`,
            hint: `${k?.unitsSold ?? 0}/${k?.unitsTotal ?? 0}`,
          },
          {
            id: 'fu',
            label: 'متابعات متأخرة',
            value: k?.overdueFollowups ?? 0,
            hint: `${k?.customers ?? 0} عميل`,
            tone: (k?.overdueFollowups ?? 0) > 0 ? 'bad' : 'ok',
          },
        ]}
      />

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <StackingMatrix
            buildings={summary?.stacking ?? []}
            loading={isLoading}
            onUnitClick={(unit, building) => setDrawer({ unit, building })}
          />
        </div>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold text-slate-900">مستهدف الحجوزات الشهر</p>
          <GaugeBar
            actual={summary?.collectionGauge.collected ?? 0}
            target={summary?.collectionGauge.expected ?? 0}
            actualLabel="مؤكد"
            targetLabel="إجمالي حجوزات"
          />
          <div className="mt-3">
            <SegmentedBar
              segments={[
                { label: 'متاح', value: k?.unitsAvailable ?? 0, color: '#059669' },
                { label: 'محجوز', value: k?.unitsReserved ?? 0, color: '#D97706' },
                { label: 'مباع', value: k?.unitsSold ?? 0, color: '#64748B' },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TriageQueue
          title="معلقات الحجز — 48 ساعة"
          loading={isLoading}
          items={(summary?.expiring48h ?? []).map((row) => ({
            id: row.id,
            title: `${row.unitCode} · ${row.customerName}`,
            meta: `انتهاء ${hoursLeft(row.expiryDate)}`,
            amount: <SensitiveValue>{formatEgp(row.amount)}</SensitiveValue>,
            tone: 'bad',
            actions: [
              {
                label: busy === row.id ? '…' : 'تمديد',
                onClick: () => void runAction(row.id, `/real-estate/reservations/${row.id}/extend`),
              },
              {
                label: 'إلغاء وإتاحة',
                tone: 'danger',
                onClick: () => void runAction(row.id, `/real-estate/reservations/${row.id}/cancel`),
              },
            ],
          }))}
        />
        <DataGridDense
          title="تحصيلات الأسبوع"
          loading={isLoading}
          rows={summary?.weekInstallments ?? []}
          onRowOpen={(r) => {
            window.location.href = `/real-estate/contracts/${r.contractId}`;
          }}
          columns={[
            { id: 'c', header: 'العميل', cell: (r) => r.customerName },
            { id: 'u', header: 'الوحدة', cell: (r) => <span className={DASH_NUM}>{r.unitCode}</span> },
            { id: 'd', header: 'الاستحقاق', cell: (r) => r.dueDate.slice(0, 10) },
            { id: 'h', header: 'هجري', cell: (r) => toHijri(r.dueDate.slice(0, 10)) || '—' },
            {
              id: 'a',
              header: 'المبلغ',
              numeric: true,
              cell: (r) => <SensitiveValue>{formatEgp(r.balance || r.amount)}</SensitiveValue>,
            },
            {
              id: 'x',
              header: '',
              cell: (r) => (
                <Link
                  href={`/real-estate/contracts/${r.contractId}`}
                  className="border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-[#0E79AA]"
                >
                  تسديد
                </Link>
              ),
            },
          ]}
        />
      </div>

      {drawer ? (
        <aside className="fixed inset-y-0 start-0 z-40 w-80 border-s border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{drawer.unit.unitCode}</h3>
            <button type="button" className="text-xs text-slate-500" onClick={() => setDrawer(null)}>
              إغلاق
            </button>
          </div>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">المبنى</dt>
              <dd className="font-medium">{drawer.building.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">الدور / المساحة</dt>
              <dd className={DASH_NUM}>
                {drawer.unit.floor} · {drawer.unit.netArea} م²
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">السعر</dt>
              <dd className={DASH_NUM}>
                <SensitiveValue>{formatEgp(drawer.unit.totalPrice)}</SensitiveValue>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">الحالة</dt>
              <dd>{drawer.unit.status}</dd>
            </div>
            {drawerActions ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-slate-500">العميل</dt>
                  <dd>{drawerActions.customerName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">انتهاء الحجز</dt>
                  <dd className={DASH_NUM}>{hoursLeft(drawerActions.expiryDate)}</dd>
                </div>
              </>
            ) : null}
          </dl>
          <div className="mt-3 flex flex-col gap-1.5">
            {drawerActions ? (
              <>
                <button
                  type="button"
                  className="border border-slate-200 px-2 py-1 text-xs font-semibold"
                  onClick={() => void runAction(drawerActions.id, `/real-estate/reservations/${drawerActions.id}/extend`)}
                >
                  تمديد +7 أيام
                </button>
                <button
                  type="button"
                  className="border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700"
                  onClick={() => void runAction(drawerActions.id, `/real-estate/reservations/${drawerActions.id}/cancel`)}
                >
                  إلغاء وإتاحة
                </button>
              </>
            ) : (
              <Link
                href="/real-estate-investment/operations/reservation"
                className="border border-[#0E79AA] px-2 py-1 text-center text-xs font-semibold text-[#0E79AA]"
              >
                حجز هذه الوحدة
              </Link>
            )}
          </div>
        </aside>
      ) : null}
    </CommandCenter>
  );
}
