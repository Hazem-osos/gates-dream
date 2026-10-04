'use client';

import { useEffect, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type Center = {
  id: string;
  code: string;
  arabicName: string;
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  share: number | null;
  months: Array<{ month: number; label: string; netProfit: number }>;
};

type Report = {
  year: number;
  month: number;
  monthLabel: string;
  currencyName: string;
  companyNet: number;
  centers: Center[];
  unassigned: { revenue: number; cogs: number; expenses: number; netProfit: number };
};

type RechartsModule = typeof import('recharts');

function money(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function YearLine({ months }: { months: Center['months'] }) {
  const [R, setR] = useState<RechartsModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import('recharts').then((loaded) => {
      if (!cancelled) setR(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!R) return <div className="h-56 animate-pulse rounded-xl bg-white/10" />;
  const { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#e2e8f0' }} />
        <YAxis tick={{ fontSize: 10, fill: '#e2e8f0' }} width={56} />
        <Tooltip formatter={(value: number) => money(Number(value))} />
        <Line type="monotone" dataKey="netProfit" name="صافي الربح" stroke="#6ee7b7" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function CostCenterProfitabilityPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useApiQuery<Report>(
    ['cost-center-profitability', year, month],
    '/accounting/reports/cost-center-profitability',
    { year, month },
    { staleTime: 30_000 }
  );
  const data = query.data?.data;
  const selected = data?.centers.find((center) => center.id === selectedId) ?? data?.centers[0] ?? null;
  const unassigned = data?.unassigned;
  const unassignedAmount = unassigned ? Math.abs(unassigned.revenue) + Math.abs(unassigned.cogs) + Math.abs(unassigned.expenses) : 0;
  const maxAbs = Math.max(1, ...(data?.centers.map((center) => Math.abs(center.netProfit)) ?? [1]));
  const years = [today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ربحية مراكز التكلفة</h1>
          <p className="mt-1 text-sm text-slate-500">اختَر الشهر، وشوف مين كسب ومين خسر. اضغط على المركز عشان تشوف سنته.</p>
        </div>
        <label className="text-xs font-medium text-slate-600">
          السنة
          <select
            className="ms-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={year}
            onChange={(event) => {
              setYear(Number(event.target.value));
              setSelectedId(null);
            }}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MONTHS.map((label, index) => {
          const value = index + 1;
          const active = value === month;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setMonth(value);
                setSelectedId(null);
              }}
              className={
                active
                  ? 'rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200'
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {query.isError ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">تعذر تحميل ربحية المراكز.</p> : null}
      {!data && query.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-slate-100" /> : null}

      {data && unassignedAmount > 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
          فيه حركة أرباح اترحلَت من غير مركز تكلفة في {data.monthLabel}: صافي {money(unassigned?.netProfit ?? 0)} {data.currencyName}. مش داخلة في الترتيب.
        </p>
      ) : null}

      {data && data.centers.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          لا حركة مرحلة على مراكز التكلفة في {data.monthLabel} {data.year}.
        </p>
      ) : null}

      {data && selected ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_1.15fr]">
          <section className="overflow-hidden rounded-2xl bg-gradient-to-l from-brand to-slate-900 p-5 text-white">
            <p className="text-sm text-white/75">
              {selected.code} — {data.monthLabel} {data.year}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{selected.arabicName}</h2>
            <p className={`mt-3 text-4xl font-bold tabular-nums ${selected.netProfit < 0 ? 'text-rose-200' : ''}`}>
              {money(selected.netProfit)}
            </p>
            <p className="mt-1 text-xs text-white/70">{selected.netProfit < 0 ? 'صافي خسارة' : 'صافي ربح'} · {data.currencyName}</p>
            <p className="mt-4 text-sm text-white/85">
              إيراد {money(selected.revenue)} − تكلفة {money(selected.cogs)} − مصروف {money(selected.expenses)}
            </p>
            <p className="mt-2 text-xs text-white/70">
              {selected.share == null ? 'الشركة متعادلة هذا الشهر.' : `نصيبه ${selected.share.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}٪ من صافي المراكز (${money(data.companyNet)}).`}
            </p>
            <div className="mt-4 h-56">
              <YearLine months={selected.months} />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <h2 className="px-2 py-2 text-sm font-semibold text-slate-800">ترتيب {data.monthLabel}</h2>
            <ul className="max-h-[32rem] space-y-1 overflow-auto">
              {data.centers.map((center, index) => {
                const active = center.id === selected.id;
                const width = Math.max(6, (Math.abs(center.netProfit) / maxAbs) * 100);
                return (
                  <li key={center.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(center.id)}
                      className={`w-full rounded-xl px-3 py-3 text-right ${active ? 'bg-brand/10 ring-1 ring-brand' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="me-2 text-xs text-slate-400">{(index + 1).toLocaleString('ar-EG')}</span>
                          <span className="font-semibold text-slate-900">{center.arabicName}</span>
                          <span className="ms-2 text-xs text-slate-400">{center.code}</span>
                        </span>
                        <span className={`shrink-0 font-semibold tabular-nums ${center.netProfit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {money(center.netProfit)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${center.netProfit < 0 ? 'bg-rose-400' : 'bg-emerald-500'}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
