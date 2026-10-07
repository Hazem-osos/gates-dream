'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DEBIT = '#0E4C6E';
const CREDIT = '#0F9B8E';

type Row = Record<string, unknown>;

function amount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function money(value: number): string {
  if (!value) return '';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moneyFull(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} م`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)} ألف`;
  return moneyFull(value);
}

function Figure({ value, tone }: { value: number; tone: 'debit' | 'credit' | 'total' }) {
  if (!value) return <span className="text-slate-300">—</span>;
  const color = tone === 'credit' ? 'text-teal-700' : tone === 'total' ? 'text-slate-900' : 'text-slate-700';
  return <span className={`tabular-nums ${color}`}>{money(value)}</span>;
}

function Pair({ debit, credit, tone }: { debit: number; credit: number; tone?: 'total' }) {
  return (
    <>
      <td className="border-b border-slate-100 px-2 py-2 text-center">
        <Figure value={debit} tone={tone ?? 'debit'} />
      </td>
      <td className="border-b border-e border-slate-100 px-2 py-2 text-center">
        <Figure value={credit} tone={tone === 'total' ? 'total' : 'credit'} />
      </td>
    </>
  );
}

export function MonthlyReviewSheet({ rows }: { rows: Row[] }) {
  const totals = rows.reduce(
    (sum: {
      openingDebit: number;
      openingCredit: number;
      totalDebit: number;
      totalCredit: number;
      months: Array<{ debit: number; credit: number }>;
    }, row) => {
      sum.openingDebit += amount(row.openingDebit);
      sum.openingCredit += amount(row.openingCredit);
      sum.totalDebit += amount(row.totalDebit);
      sum.totalCredit += amount(row.totalCredit);
      for (let month = 1; month <= 12; month += 1) {
        sum.months[month - 1].debit += amount(row[`m${month}Debit`]);
        sum.months[month - 1].credit += amount(row[`m${month}Credit`]);
      }
      return sum;
    },
    {
      openingDebit: 0,
      openingCredit: 0,
      totalDebit: 0,
      totalCredit: 0,
      months: MONTHS.map(() => ({ debit: 0, credit: 0 })),
    }
  );

  const yearDebit = totals.months.reduce((sum, month) => sum + month.debit, 0);
  const yearCredit = totals.months.reduce((sum, month) => sum + month.credit, 0);
  const peak = Math.max(...totals.months.map((month) => month.debit + month.credit), 1);
  const chartData = useMemo(
    () =>
      totals.months.map((month, index) => ({
        name: MONTHS[index],
        مدين: month.debit,
        دائن: month.credit,
      })),
    [totals.months]
  );

  return (
    <div className="monthly-review-sheet space-y-4" data-print-layout="landscape">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="رصيد ما قبله — مدين" value={totals.openingDebit} tone="debit" />
        <SummaryCard label="رصيد ما قبله — دائن" value={totals.openingCredit} tone="credit" />
        <SummaryCard label="حركة الشهور — مدين" value={yearDebit} tone="debit" />
        <SummaryCard label="حركة الشهور — دائن" value={yearCredit} tone="credit" />
      </div>

      <div className="monthly-review-screen-only rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">حركة الشهور</h3>
          <p className="text-xs text-slate-500">مدين ودائن كل شهر بعد الفلتر</p>
        </div>
        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} reversed />
              <YAxis tickFormatter={compact} tick={{ fill: '#64748b', fontSize: 11 }} width={64} />
              <Tooltip formatter={(value) => moneyFull(Number(value ?? 0))} />
              <Legend />
              <Bar dataKey="مدين" fill={DEBIT} radius={[6, 6, 0, 0]} />
              <Bar dataKey="دائن" fill={CREDIT} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12">
          {totals.months.map((month, index) => {
            const weight = (month.debit + month.credit) / peak;
            return (
              <div key={MONTHS[index]} className="rounded-xl border border-slate-100 px-2 py-2 text-center">
                <div className="text-[11px] text-slate-500">{MONTHS[index]}</div>
                <div className="mx-auto mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#1787B8]" style={{ width: `${Math.max(weight * 100, weight > 0 ? 8 : 0)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-sm" dir="rtl">
          <thead>
            <tr className="bg-[#0E4C6E] text-white">
              <th rowSpan={2} className="sticky right-0 z-20 min-w-56 border-e border-white/10 bg-[#0E4C6E] px-4 py-3 text-right font-medium">
                الحساب
              </th>
              <th colSpan={2} className="border-e border-white/10 px-2 py-2 font-medium">
                رصيد ما قبله
              </th>
              {MONTHS.map((month) => (
                <th key={month} colSpan={2} className="border-e border-white/10 px-2 py-2 font-medium">
                  {month}
                </th>
              ))}
              <th colSpan={2} className="bg-[#0B3D58] px-2 py-2 font-medium">
                الإجمالي
              </th>
            </tr>
            <tr className="bg-[#1787B8] text-xs text-white">
              {Array.from({ length: 28 }, (_, index) => (
                <th key={index} className={`px-2 py-1.5 font-normal ${index % 2 === 1 ? 'border-e border-white/15' : ''}`}>
                  {index % 2 === 0 ? 'مدين' : 'دائن'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.accountId ?? index)} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                <td
                  className={`sticky right-0 z-10 border-b border-e border-slate-100 px-4 py-2 font-medium text-slate-800 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  {String(row.account ?? '')}
                </td>
                <Pair debit={amount(row.openingDebit)} credit={amount(row.openingCredit)} />
                {MONTHS.map((_, monthIndex) => (
                  <Pair
                    key={monthIndex}
                    debit={amount(row[`m${monthIndex + 1}Debit`])}
                    credit={amount(row[`m${monthIndex + 1}Credit`])}
                  />
                ))}
                <td className="border-b border-slate-100 bg-emerald-50/70 px-2 py-2 text-center">
                  <Figure value={amount(row.totalDebit)} tone="total" />
                </td>
                <td className="border-b border-slate-100 bg-emerald-50/70 px-2 py-2 text-center">
                  <Figure value={amount(row.totalCredit)} tone="total" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#0E4C6E] font-semibold text-white">
              <td className="sticky right-0 z-10 bg-[#0E4C6E] px-4 py-3">المجموع</td>
              <td className="px-2 py-3 text-center tabular-nums">{money(totals.openingDebit)}</td>
              <td className="border-e border-white/10 px-2 py-3 text-center tabular-nums">{money(totals.openingCredit)}</td>
              {totals.months.map((month, index) => (
                <FragmentPair key={index} debit={month.debit} credit={month.credit} />
              ))}
              <td className="bg-[#0B3D58] px-2 py-3 text-center tabular-nums">{money(totals.totalDebit)}</td>
              <td className="bg-[#0B3D58] px-2 py-3 text-center tabular-nums">{money(totals.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'debit' | 'credit' }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tone === 'debit' ? 'border-sky-100 bg-sky-50' : 'border-teal-100 bg-teal-50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'debit' ? 'text-[#0E4C6E]' : 'text-teal-800'}`}>
        {moneyFull(value)}
      </div>
    </div>
  );
}

function FragmentPair({ debit, credit }: { debit: number; credit: number }) {
  return (
    <>
      <td className="px-2 py-3 text-center tabular-nums">{money(debit)}</td>
      <td className="border-e border-white/10 px-2 py-3 text-center tabular-nums">{money(credit)}</td>
    </>
  );
}
