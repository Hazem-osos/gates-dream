'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatMoneyAr } from '@/lib/formatMoney';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { DashboardMotion } from '@/components/inventory/warehouse-dashboard/DashboardMotion';
import { CompareBars } from '@/components/inventory/warehouse-dashboard/WarehouseCharts';

type WarehouseCard = {
  id: string;
  name: string;
  quantity: number;
  stockValue: number;
  inbound: number;
  outbound: number;
  deadQuantity: number;
  deadValue: number;
  speed: number | null;
  deadRatio: number | null;
};

type ExpiryHit = {
  itemId: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  daysLeft: number;
  quantity: number;
  expiryDate: string;
};

type Compare = {
  warehouses: WarehouseCard[];
  expiry: { d30: ExpiryHit[]; d60: ExpiryHit[]; d90: ExpiryHit[] };
};

function Band({
  title,
  rows,
  max,
  open,
  onToggle,
  delay,
}: {
  title: string;
  rows: ExpiryHit[];
  max: number;
  open: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const width = max > 0 ? Math.max(8, Math.round((rows.length / max) * 100)) : 0;
  return (
    <section className="wh-rise rounded-2xl bg-white p-4 ring-1 ring-[#D6EAF3]" style={{ animationDelay: `${delay}ms` }}>
      <button type="button" onClick={onToggle} className="w-full text-right">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#094C6B]">{title}</h2>
          <span className="text-sm font-bold tabular-nums text-[#0E78AA]">{formatMoneyAr(rows.length)}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#EAF6FB]">
          <div className="wh-bar h-full rounded-full bg-[#0E78AA]" style={{ width: `${width}%`, animationDelay: `${delay + 80}ms` }} />
        </div>
        <p className="mt-2 text-xs text-[#4B6472]">{open ? 'إخفاء الأصناف' : 'اضغط لعرض الأصناف'}</p>
      </button>
      {open ? (
        <ul className="mt-3 max-h-64 space-y-1 overflow-auto">
          {rows.slice(0, 20).map((row) => (
            <li key={`${row.itemId}-${row.warehouseId}-${row.expiryDate}`}>
              <Link href={`/inventory/creations/item-card?id=${row.itemId}`} className="block rounded-lg px-2 py-1.5 hover:bg-[#F3FAFD]">
                <span className="text-sm text-[#094C6B]">{row.itemName}</span>
                <span className="mt-0.5 block text-xs text-[#4B6472]">
                  {row.warehouseName} · بعد {formatMoneyAr(row.daysLeft)} يوم · {formatMoneyAr(row.quantity)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function WarehouseComparePage() {
  const params = useOwnTabSearchParams();
  const focusId = params.get('warehouseId') || '';
  const [band, setBand] = useState<'d30' | 'd60' | 'd90' | ''>('d30');
  const query = useApiQuery<Compare>(
    ['warehouse-compare'],
    '/inventory/reports/warehouse-compare',
    undefined,
    { staleTime: 0 }
  );
  const data = query.data?.data;
  const maxBand = useMemo(() => {
    if (!data) return 0;
    return Math.max(data.expiry.d30.length, data.expiry.d60.length, data.expiry.d90.length);
  }, [data]);

  return (
    <DashboardMotion>
      <div className="mx-auto max-w-6xl space-y-4 p-4" dir="rtl">
        <header className="wh-rise overflow-hidden rounded-2xl bg-gradient-to-l from-[#0F9B8E] to-[#094C6B] p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/80">تقارير المخازن</p>
              <h1 className="mt-1 text-2xl font-bold">مقارنة المخازن</h1>
              <p className="mt-2 max-w-xl text-sm text-white/85">
                قيمة كل مخزن، سرعة حركته هذا الشهر، والراكد الذي لم يتحرك منذ 90 يومًا. الأرقام من الحركات المرحلة.
              </p>
            </div>
            <Link
              href="/inventory/reports/warehouse-pulse"
              className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25"
            >
              نبض المخازن
            </Link>
          </div>
        </header>

        {query.isError ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">تعذر تحميل مقارنة المخازن.</p>
        ) : null}
        {!data && query.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-[#EAF6FB]" /> : null}

        {data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.warehouses.map((warehouse, index) => {
                const focused = focusId === warehouse.id;
                return (
                  <article
                    key={warehouse.id}
                    className={`wh-rise rounded-2xl bg-white p-4 ring-1 transition ${
                      focused ? 'ring-2 ring-[#0E78AA] shadow-md' : 'ring-[#D6EAF3]'
                    }`}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <h2 className="text-sm font-semibold text-[#094C6B]">{warehouse.name}</h2>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-[#094C6B]">{formatMoneyAr(warehouse.stockValue)}</p>
                    <p className="text-xs text-[#4B6472]">قيمة المخزون · الكمية {formatMoneyAr(warehouse.quantity)}</p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-[#4B6472]">وارد</dt>
                        <dd className="font-semibold text-emerald-700">{formatMoneyAr(warehouse.inbound)}</dd>
                      </div>
                      <div>
                        <dt className="text-[#4B6472]">صادر</dt>
                        <dd className="font-semibold text-rose-700">{formatMoneyAr(warehouse.outbound)}</dd>
                      </div>
                      <div>
                        <dt className="text-[#4B6472]">راكد</dt>
                        <dd className="font-semibold text-amber-700">{formatMoneyAr(warehouse.deadValue)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <section className="wh-rise rounded-2xl bg-white p-4 ring-1 ring-[#D6EAF3]">
                <h2 className="mb-2 text-sm font-semibold text-[#094C6B]">قيمة المخزون</h2>
                <CompareBars rows={data.warehouses} dataKey="stockValue" color="#0E78AA" />
              </section>
              <section className="wh-rise rounded-2xl bg-white p-4 ring-1 ring-[#D6EAF3]" style={{ animationDelay: '80ms' }}>
                <h2 className="mb-2 text-sm font-semibold text-[#094C6B]">سرعة الحركة</h2>
                <p className="mb-2 text-xs text-[#4B6472]">صادر الشهر ÷ الرصيد.</p>
                <CompareBars rows={data.warehouses} dataKey="speed" color="#0F9B8E" asPercent />
              </section>
              <section className="wh-rise rounded-2xl bg-white p-4 ring-1 ring-[#D6EAF3]" style={{ animationDelay: '140ms' }}>
                <h2 className="mb-2 text-sm font-semibold text-[#094C6B]">نسبة الراكد</h2>
                <CompareBars rows={data.warehouses} dataKey="deadRatio" color="#E3A008" asPercent />
              </section>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Band
                title="خلال 30 يوم"
                rows={data.expiry.d30}
                max={maxBand}
                open={band === 'd30'}
                onToggle={() => setBand((current) => (current === 'd30' ? '' : 'd30'))}
                delay={40}
              />
              <Band
                title="من 31 إلى 60 يوم"
                rows={data.expiry.d60}
                max={maxBand}
                open={band === 'd60'}
                onToggle={() => setBand((current) => (current === 'd60' ? '' : 'd60'))}
                delay={100}
              />
              <Band
                title="من 61 إلى 90 يوم"
                rows={data.expiry.d90}
                max={maxBand}
                open={band === 'd90'}
                onToggle={() => setBand((current) => (current === 'd90' ? '' : 'd90'))}
                delay={160}
              />
            </div>
          </>
        ) : null}
      </div>
    </DashboardMotion>
  );
}
