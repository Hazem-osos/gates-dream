'use client';

import { useEffect, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type Delta = { amount: number; percent: number | null };
type MonthRow = {
  year: number;
  month: number;
  label: string;
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number | null;
  netMargin: number | null;
};
type Performance = {
  current: MonthRow;
  previousMonth: MonthRow;
  sameMonthLastYear: MonthRow;
  months: MonthRow[];
  topExpenses: Array<{ accountId: string; code: string; arabicName: string; amount: number }>;
  versusPrevious: { revenue: Delta; grossProfit: Delta; expenses: Delta; netProfit: Delta };
  versusLastYear: { netProfit: Delta };
  currencyName: string;
  books: { balanced: boolean; difference: number; unpostedCount: number };
};

type RechartsModule = typeof import('recharts');

function money(value: number) {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value: number | null) {
  if (value == null) return '—';
  return `${value.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}٪`;
}

function reading(data: Performance) {
  const net = data.current.netProfit;
  const prev = data.previousMonth.netProfit;
  const last = data.sameMonthLastYear.netProfit;
  const state = net > 0 ? 'الشهر رابح' : net < 0 ? 'الشهر خاسر' : 'الشهر متعادل';
  const againstPrev =
    net > prev ? 'وصافي الربح أعلى من الشهر السابق' : net < prev ? 'وصافي الربح أقل من الشهر السابق' : 'وصافي الربح ثابت عن الشهر السابق';
  const againstYear =
    net > last
      ? `وأعلى من ${data.sameMonthLastYear.label} ${data.sameMonthLastYear.year}`
      : net < last
        ? `وأقل من ${data.sameMonthLastYear.label} ${data.sameMonthLastYear.year}`
        : `وثابت عن ${data.sameMonthLastYear.label} ${data.sameMonthLastYear.year}`;
  return `${state}، ${againstPrev}، ${againstYear}.`;
}

function DeltaText({ delta, invert = false, light = false }: { delta: Delta; invert?: boolean; light?: boolean }) {
  const good = invert ? delta.amount < 0 : delta.amount > 0;
  const bad = invert ? delta.amount > 0 : delta.amount < 0;
  const tone = good
    ? light ? 'text-emerald-200' : 'text-emerald-700'
    : bad
      ? light ? 'text-rose-200' : 'text-rose-700'
      : light ? 'text-white/70' : 'text-slate-500';
  const mark = delta.amount > 0 ? '▲' : delta.amount < 0 ? '▼' : '–';
  return (
    <span className={`text-xs font-semibold ${tone}`}>
      {mark} {money(Math.abs(delta.amount))}
      {delta.percent != null ? ` (${pct(Math.abs(delta.percent))})` : ''}
    </span>
  );
}

function YearChart({ months }: { months: MonthRow[] }) {
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
  if (!R) return <div className="h-72 animate-pulse rounded-xl bg-slate-100" />;
  const { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10 }} width={64} />
        <Tooltip formatter={(value: number) => money(Number(value))} />
        <Legend />
        <Bar dataKey="revenue" name="الإيرادات" fill="#0E78AA" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cogs" name="تكلفة المبيعات" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="المصروفات" fill="#CB5B53" radius={[4, 4, 0, 0]} />
        <Line dataKey="netProfit" name="صافي الربح" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ExpenseChart({ items }: { items: Performance['topExpenses'] }) {
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
  if (!items.length) {
    return <p className="py-16 text-center text-sm text-slate-500">لا مصروفات مرحلة في هذا الشهر.</p>;
  }
  if (!R) return <div className="h-72 animate-pulse rounded-xl bg-slate-100" />;
  const { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;
  const data = items.map((item) => ({
    name: item.arabicName.length > 18 ? `${item.arabicName.slice(0, 18)}…` : item.arabicName,
    amount: item.amount,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: number) => money(Number(value))} />
        <Bar dataKey="amount" name="المصروف" fill="#CB5B53" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function MonthlyPerformancePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const query = useApiQuery<Performance>(
    ['monthly-performance', year, month],
    '/accounting/reports/monthly-performance',
    { year, month },
    { staleTime: 30_000 }
  );
  const data = query.data?.data;
  const currentYear = today.getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">الأداء المالي الشهري</h1>
          <p className="mt-1 text-sm text-slate-500">ربحية كل شهر من القيود المرحلة، مقارنة بالشهر السابق ونفس الشهر من السنة الماضية.</p>
        </div>
        <label className="text-xs font-medium text-slate-600">
          السنة
          <select
            className="ms-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
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
              onClick={() => setMonth(value)}
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

      {query.isError ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">تعذر تحميل الأداء المالي.</p>
      ) : null}

      {!data && query.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-slate-100" /> : null}

      {data ? (
        <>
          <section className="overflow-hidden rounded-2xl bg-gradient-to-l from-brand to-slate-900 text-white">
            <div className="grid gap-6 p-5 md:grid-cols-[1.3fr_1fr] md:p-6">
              <div>
                <p className="text-sm text-white/80">
                  صافي ربح {data.current.label} {data.current.year}
                </p>
                <p className={`mt-2 text-4xl font-bold tracking-tight ${data.current.netProfit < 0 ? 'text-rose-200' : ''}`}>
                  {money(data.current.netProfit)}
                </p>
                <p className="mt-1 text-xs text-white/70">{data.currencyName}</p>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/90">{reading(data)}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  <span className="rounded-full bg-white/15 px-3 py-1">
                    عن الشهر السابق <DeltaText delta={data.versusPrevious.netProfit} light />
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1">
                    عن {data.sameMonthLastYear.label} {data.sameMonthLastYear.year}{' '}
                    <DeltaText delta={data.versusLastYear.netProfit} light />
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['الإيرادات', data.current.revenue],
                  ['تكلفة المبيعات', data.current.cogs],
                  ['مجمل الربح', data.current.grossProfit],
                  ['المصروفات', data.current.expenses],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-white/10 px-3 py-3">
                    <p className="text-[11px] text-white/70">{label}</p>
                    <p className="mt-1 font-semibold tabular-nums">{money(Number(value))}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="border-t border-white/10 px-5 py-3 text-xs text-white/80 md:px-6">
              {money(data.current.revenue)} إيراد − {money(data.current.cogs)} تكلفة = {money(data.current.grossProfit)} مجمل −{' '}
              {money(data.current.expenses)} مصروف = {money(data.current.netProfit)} صافي
            </p>
          </section>

          <div
            className={
              data.books.balanced && data.books.unpostedCount === 0
                ? 'rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
                : 'rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950'
            }
          >
            {data.books.balanced
              ? 'حركة الشهر متوازنة: المدين يساوي الدائن.'
              : `حركة الشهر غير متوازنة. الفرق ${money(data.books.difference)}.`}
            {data.books.unpostedCount > 0
              ? ` وفيه ${data.books.unpostedCount.toLocaleString('ar-EG')} قيد غير مرحّل، والأرقام فوق لا تشمله.`
              : ' ولا يوجد قيد غير مرحّل في هذا الشهر.'}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs text-slate-500">الإيرادات</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(data.current.revenue)}</p>
              <p className="mt-2">
                عن الشهر السابق <DeltaText delta={data.versusPrevious.revenue} />
              </p>
            </article>
            <article className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs text-slate-500">مجمل الربح</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(data.current.grossProfit)}</p>
              <p className="mt-1 text-xs text-slate-500">هامش مجمل {pct(data.current.grossMargin)}</p>
              <p className="mt-2">
                عن الشهر السابق <DeltaText delta={data.versusPrevious.grossProfit} />
              </p>
            </article>
            <article className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs text-slate-500">المصروفات</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{money(data.current.expenses)}</p>
              <p className="mt-1 text-xs text-slate-500">هامش صافي {pct(data.current.netMargin)}</p>
              <p className="mt-2">
                عن الشهر السابق <DeltaText delta={data.versusPrevious.expenses} invert />
              </p>
            </article>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">مسار {year}</h2>
              <div className="h-80">
                <YearChart months={data.months} />
              </div>
            </section>
            <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">أكبر المصروفات في {data.current.label}</h2>
              <div className="h-80">
                <ExpenseChart items={data.topExpenses} />
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
