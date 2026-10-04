'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatMoneyAr } from '@/lib/formatMoney';
import { formatWarehouseCount, formatWarehouseQty } from '@/lib/inventory/formatWarehouseReport';
import { DashboardMotion } from '@/components/inventory/warehouse-dashboard/DashboardMotion';
import { FlowChart, MovementBars, ValueDonut } from '@/components/inventory/warehouse-dashboard/WarehouseCharts';

type AlertRow = {
  itemId: string;
  itemName: string;
  serial: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  orderLimit?: number;
};

type ExpiryRow = {
  itemId: string;
  itemName: string;
  warehouseName: string;
  daysLeft: number;
  quantity: number;
};

type Pulse = {
  today: string;
  warehouses: Array<{ id: string; name: string }>;
  totals: {
    quantityOnHand: number;
    stockValue: number;
    belowOrderLimit: number;
    expiringWithin30: number;
    inboundToday: number;
    outboundToday: number;
  };
  days: Array<{ date: string; label: string; inbound: number; outbound: number; stacks: Record<string, number> }>;
  stackWarehouses: Array<{ id: string; name: string }>;
  slices: Array<{ id: string; name: string; quantity: number; stockValue: number }>;
  topItems: Array<{ itemId: string; name: string; serial: string; movement: number }>;
  alerts: {
    belowOrder: AlertRow[];
    belowOrderCount: number;
    expiring: ExpiryRow[];
    expiringCount: number;
    negative: AlertRow[];
    negativeCount: number;
    unpostedTransfers: Array<{ id: string; serial: string; date: string; fromName: string; toName: string }>;
    unpostedTransferCount: number;
  };
};

function Stat({
  label,
  value,
  delay,
  tone = 'text-[#094C6B]',
}: {
  label: string;
  value: string;
  delay: number;
  tone?: string;
}) {
  return (
    <article
      className="wh-rise rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#D6EAF3]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs text-[#4B6472]">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </article>
  );
}

function AlertList({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="wh-rise rounded-2xl bg-white p-4 ring-1 ring-[#D6EAF3]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#094C6B]">{title}</h2>
        {count > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
            <span className="wh-dot inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
            {formatWarehouseCount(count)}
          </span>
        ) : (
          <span className="text-xs text-[#4B6472]">لا يوجد</span>
        )}
      </div>
      {count === 0 ? <p className="text-sm text-[#4B6472]">{empty}</p> : <ul className="space-y-2">{children}</ul>}
    </section>
  );
}

export default function WarehousePulsePage() {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState('');
  const query = useApiQuery<Pulse>(
    ['warehouse-pulse', warehouseId || 'all'],
    '/inventory/reports/warehouse-pulse',
    warehouseId ? { warehouseId } : undefined,
    { staleTime: 0 }
  );
  const data = query.data?.data;

  return (
    <DashboardMotion>
      <div className="mx-auto max-w-6xl space-y-4 p-4" dir="rtl">
        <header className="wh-rise overflow-hidden rounded-2xl bg-gradient-to-l from-[#0E78AA] to-[#094C6B] p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/80">تقارير المخازن</p>
              <h1 className="mt-1 text-2xl font-bold">نبض المخازن</h1>
              <p className="mt-2 max-w-xl text-sm text-white/85">
                الرصيد والوارد والصادر من حركات المخزن المرحلة. الصلاحية من فواتير وتشغيلات أول المدة المرحلة.
              </p>
            </div>
            <Link
              href="/inventory/reports/warehouse-compare"
              className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25"
            >
              مقارنة المخازن
            </Link>
          </div>
          {data && data.warehouses.length > 0 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setWarehouseId('')}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  warehouseId === '' ? 'bg-white text-[#094C6B]' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                كل المخازن
              </button>
              {data.warehouses.map((warehouse) => (
                <button
                  key={warehouse.id}
                  type="button"
                  onClick={() => setWarehouseId(warehouse.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    warehouseId === warehouse.id ? 'bg-white text-[#094C6B]' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {warehouse.name}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {query.isError ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">تعذر تحميل نبض المخازن.</p>
        ) : null}
        {!data && query.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-[#EAF6FB]" /> : null}

        {data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Stat label="الرصيد الحالي" value={formatWarehouseQty(data.totals.quantityOnHand)} delay={40} />
              <Stat label="قيمة المخزون" value={formatMoneyAr(data.totals.stockValue)} delay={80} />
              <Stat label="تحت حد الطلب" value={formatWarehouseCount(data.totals.belowOrderLimit)} delay={120} tone="text-amber-700" />
              <Stat label="صلاحية خلال 30 يوم" value={formatWarehouseCount(data.totals.expiringWithin30)} delay={160} tone="text-rose-700" />
              <Stat label="وارد اليوم" value={formatWarehouseQty(data.totals.inboundToday)} delay={200} tone="text-emerald-700" />
              <Stat label="صادر اليوم" value={formatWarehouseQty(data.totals.outboundToday)} delay={240} tone="text-rose-700" />
            </div>

            <section className="wh-rise rounded-2xl bg-white p-4 ring-1 ring-[#D6EAF3]" style={{ animationDelay: '120ms' }}>
              <h2 className="mb-1 text-sm font-semibold text-[#094C6B]">وارد وصادر الشهر</h2>
              <p className="mb-3 text-xs text-[#4B6472]">الأعمدة وارد كل مخزن، والخط الصادر.</p>
              <FlowChart key={warehouseId || 'all'} days={data.days} stacks={data.stackWarehouses} />
            </section>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="wh-rise rounded-2xl bg-white p-4 ring-1 ring-[#D6EAF3]" style={{ animationDelay: '180ms' }}>
                <h2 className="mb-1 text-sm font-semibold text-[#094C6B]">قيمة المخزون على المخازن</h2>
                <p className="mb-3 text-xs text-[#4B6472]">اضغط الشريحة عشان تفتح مقارنة هذا المخزن.</p>
                {data.slices.length === 0 ? (
                  <p className="py-16 text-center text-sm text-[#4B6472]">لا يوجد رصيد مرحّل بعد.</p>
                ) : (
                  <ValueDonut
                    slices={data.slices}
                    onPick={(id) => router.push(`/inventory/reports/warehouse-compare?warehouseId=${encodeURIComponent(id)}`)}
                  />
                )}
              </section>
              <section className="wh-rise rounded-2xl bg-white p-4 ring-1 ring-[#D6EAF3]" style={{ animationDelay: '220ms' }}>
                <h2 className="mb-3 text-sm font-semibold text-[#094C6B]">أكثر عشرة أصناف حركة هذا الشهر</h2>
                {data.topItems.length === 0 ? (
                  <p className="py-16 text-center text-sm text-[#4B6472]">لا توجد حركة هذا الشهر.</p>
                ) : (
                  <MovementBars rows={data.topItems} />
                )}
                <ul className="mt-2 space-y-1">
                  {data.topItems.map((item) => (
                    <li key={item.itemId}>
                      <Link href={`/inventory/creations/item-card?id=${item.itemId}`} className="text-xs text-[#0E78AA] hover:underline">
                        {item.serial ? `${item.serial} — ` : ''}
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <AlertList title="تحت حد الطلب" count={data.alerts.belowOrderCount} empty="لا يوجد صنف عند حد الطلب أو أقل.">
                {data.alerts.belowOrder.map((row) => (
                  <li key={`${row.itemId}-${row.warehouseId}`}>
                    <Link href={`/inventory/creations/item-card?id=${row.itemId}`} className="block rounded-lg px-2 py-1.5 hover:bg-[#F3FAFD]">
                      <span className="text-sm font-medium text-[#094C6B]">{row.itemName}</span>
                      <span className="mt-0.5 block text-xs text-[#4B6472]">
                        {row.warehouseName} · الرصيد {formatWarehouseQty(row.quantity)} · الحد {formatWarehouseQty(row.orderLimit ?? 0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </AlertList>
              <AlertList title="صلاحية خلال 30 يوم" count={data.alerts.expiringCount} empty="لا توجد تشغيلات تنتهي خلال 30 يوم.">
                {data.alerts.expiring.map((row) => (
                  <li key={`${row.itemId}-${row.warehouseName}-${row.daysLeft}`}>
                    <Link href={`/inventory/creations/item-card?id=${row.itemId}`} className="block rounded-lg px-2 py-1.5 hover:bg-[#F3FAFD]">
                      <span className="text-sm font-medium text-[#094C6B]">{row.itemName}</span>
                      <span className="mt-0.5 block text-xs text-[#4B6472]">
                        {row.warehouseName} · بعد {formatWarehouseCount(row.daysLeft)} يوم · الكمية {formatWarehouseQty(row.quantity)}
                      </span>
                    </Link>
                  </li>
                ))}
              </AlertList>
              <AlertList title="رصيد سالب" count={data.alerts.negativeCount} empty="لا يوجد رصيد سالب.">
                {data.alerts.negative.map((row) => (
                  <li key={`${row.itemId}-${row.warehouseId}`}>
                    <Link href={`/inventory/creations/item-card?id=${row.itemId}`} className="block rounded-lg px-2 py-1.5 hover:bg-[#F3FAFD]">
                      <span className="text-sm font-medium text-[#094C6B]">{row.itemName}</span>
                      <span className="mt-0.5 block text-xs text-rose-700">
                        {row.warehouseName} · {formatWarehouseQty(row.quantity)}
                      </span>
                    </Link>
                  </li>
                ))}
              </AlertList>
              <AlertList title="نقل مخزني غير مرحّل" count={data.alerts.unpostedTransferCount} empty="لا يوجد نقل مخزني غير مرحّل.">
                {data.alerts.unpostedTransfers.map((row) => (
                  <li key={row.id}>
                    <Link href={`/inventory/operations/transfer?id=${row.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-[#F3FAFD]">
                      <span className="text-sm font-medium text-[#0E78AA]">{row.serial}</span>
                      <span className="mt-0.5 block text-xs text-[#4B6472]">
                        {row.fromName} → {row.toName}
                      </span>
                    </Link>
                  </li>
                ))}
              </AlertList>
            </div>
          </>
        ) : null}
      </div>
    </DashboardMotion>
  );
}
