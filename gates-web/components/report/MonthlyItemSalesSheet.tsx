'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const MEASURES = [
  { key: 'SaleQty', label: 'كمية', kind: 'qty' },
  { key: 'SaleAmount', label: 'قيمة', kind: 'amount' },
  { key: 'ReturnQty', label: 'كمية', kind: 'qty' },
  { key: 'ReturnAmount', label: 'قيمة', kind: 'amount' },
  { key: 'NetQty', label: 'كمية', kind: 'qty' },
  { key: 'NetAmount', label: 'قيمة', kind: 'amount' },
] as const;

type Row = Record<string, unknown>;

function amount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function money(value: number): string {
  if (!value) return '';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qty(value: number): string {
  if (!value) return '';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
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

function Figure({ value, kind }: { value: number; kind: 'qty' | 'amount' }) {
  if (!value) return <span className="text-slate-300">—</span>;
  return (
    <span className={`tabular-nums ${kind === 'amount' ? 'text-slate-800' : 'text-slate-600'}`}>
      {kind === 'amount' ? money(value) : qty(value)}
    </span>
  );
}

function monthValue(row: Row, month: number, key: string): number {
  return amount(row[`m${month}${key}`]);
}

type MonthCell = {
  SaleQty: number;
  SaleAmount: number;
  ReturnQty: number;
  ReturnAmount: number;
  NetQty: number;
  NetAmount: number;
};

type SalesTotals = {
  saleQty: number;
  saleAmount: number;
  returnQty: number;
  returnAmount: number;
  months: MonthCell[];
};

function emptyTotals(): SalesTotals {
  return {
    saleQty: 0,
    saleAmount: 0,
    returnQty: 0,
    returnAmount: 0,
    months: MONTHS.map(() => ({
      SaleQty: 0,
      SaleAmount: 0,
      ReturnQty: 0,
      ReturnAmount: 0,
      NetQty: 0,
      NetAmount: 0,
    })),
  };
}

export function MonthlyItemSalesSheet({ rows }: { rows: Row[] }) {
  const totals = rows.reduce<SalesTotals>((sum, row) => {
    sum.saleQty += amount(row.saleQty);
    sum.saleAmount += amount(row.saleAmount);
    sum.returnQty += amount(row.returnQty);
    sum.returnAmount += amount(row.returnAmount);
    for (let month = 1; month <= 12; month += 1) {
      const cell = sum.months[month - 1];
      for (const measure of MEASURES) {
        cell[measure.key] += monthValue(row, month, measure.key);
      }
    }
    return sum;
  }, emptyTotals());
  const netQty = totals.saleQty - totals.returnQty;
  const netAmount = totals.saleAmount - totals.returnAmount;

  const chartData = useMemo(
    () => totals.months.map((month, index) => ({ name: MONTHS[index], 'صافي القيمة': month.NetAmount })),
    [totals.months]
  );

  return (
    <div className="space-y-4" data-print-layout="landscape">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard title="المبيعات" qtyValue={totals.saleQty} amountValue={totals.saleAmount} tone="sky" />
        <SummaryCard title="المردودات" qtyValue={totals.returnQty} amountValue={totals.returnAmount} tone="rose" />
        <SummaryCard title="الصافي" qtyValue={netQty} amountValue={netAmount} tone="teal" />
      </div>

      <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">صافي القيمة في كل شهر</h3>
        <div className="h-56 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} reversed />
              <YAxis tickFormatter={compact} tick={{ fill: '#64748b', fontSize: 11 }} width={64} />
              <Tooltip formatter={(value) => moneyFull(Number(value ?? 0))} />
              <Bar dataKey="صافي القيمة" fill="#0E4C6E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-sm" dir="rtl">
            <thead>
              <tr className="bg-[#0E4C6E] text-white">
                <th rowSpan={3} className="sticky right-0 z-20 min-w-56 border-e border-white/10 bg-[#0E4C6E] px-4 py-3 text-right font-medium">
                  الصنف
                </th>
                {MONTHS.map((month) => (
                  <th key={month} colSpan={6} className="border-e border-white/10 px-2 py-2 font-medium">
                    {month}
                  </th>
                ))}
                <th colSpan={6} className="bg-[#0B3D58] px-2 py-2 font-medium">
                  الإجمالي
                </th>
              </tr>
              <tr className="bg-[#14658A] text-xs text-white">
                {Array.from({ length: 13 }, (_, index) => (
                  <GroupHeaders key={index} />
                ))}
              </tr>
              <tr className="bg-[#1787B8] text-xs text-white">
                {Array.from({ length: 13 }, (_, group) =>
                  MEASURES.map((measure, index) => (
                    <th
                      key={`${group}-${measure.key}`}
                      className={`px-2 py-1.5 font-normal ${index === MEASURES.length - 1 ? 'border-e border-white/15' : ''}`}
                    >
                      {measure.label}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.itemId ?? index)} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                  <td
                    className={`sticky right-0 z-10 border-b border-e border-slate-100 px-4 py-2 font-medium text-slate-800 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    }`}
                  >
                    {String(row.itemName ?? '')}
                  </td>
                  {MONTHS.map((_, monthIndex) => (
                    <MeasureCells key={monthIndex} values={MEASURES.map((measure) => monthValue(row, monthIndex + 1, measure.key))} />
                  ))}
                  <MeasureCells
                    values={[
                      amount(row.saleQty),
                      amount(row.saleAmount),
                      amount(row.returnQty),
                      amount(row.returnAmount),
                      amount(row.netQty),
                      amount(row.netAmount),
                    ]}
                    emphasize
                  />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#0E4C6E] font-semibold text-white">
                <td className="sticky right-0 z-10 bg-[#0E4C6E] px-4 py-3">المجموع</td>
                {totals.months.map((month, index) => (
                  <FooterCells key={index} values={MEASURES.map((measure) => month[measure.key])} />
                ))}
                <FooterCells
                  values={[totals.saleQty, totals.saleAmount, totals.returnQty, totals.returnAmount, netQty, netAmount]}
                  emphasize
                />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  qtyValue,
  amountValue,
  tone,
}: {
  title: string;
  qtyValue: number;
  amountValue: number;
  tone: 'sky' | 'rose' | 'teal';
}) {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-100 bg-rose-50 text-rose-800'
      : tone === 'teal'
        ? 'border-teal-100 bg-teal-50 text-teal-800'
        : 'border-sky-100 bg-sky-50 text-[#0E4C6E]';
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-sm">كمية: <span className="font-semibold tabular-nums">{qty(qtyValue) || '0'}</span></div>
      <div className="text-sm">قيمة: <span className="font-semibold tabular-nums">{moneyFull(amountValue)}</span></div>
    </div>
  );
}

function GroupHeaders() {
  return (
    <>
      <th colSpan={2} className="px-2 py-1 font-normal">مبيعات</th>
      <th colSpan={2} className="px-2 py-1 font-normal">مردودات</th>
      <th colSpan={2} className="border-e border-white/15 px-2 py-1 font-normal">الصافي</th>
    </>
  );
}

function MeasureCells({ values, emphasize = false }: { values: number[]; emphasize?: boolean }) {
  return (
    <>
      {values.map((value, index) => (
        <td
          key={index}
          className={`border-b border-slate-100 px-2 py-2 text-center ${index === values.length - 1 ? 'border-e' : ''} ${
            emphasize ? 'bg-emerald-50/70' : ''
          }`}
        >
          <Figure value={value} kind={index % 2 === 0 ? 'qty' : 'amount'} />
        </td>
      ))}
    </>
  );
}

function FooterCells({ values, emphasize = false }: { values: number[]; emphasize?: boolean }) {
  return (
    <>
      {values.map((value, index) => (
        <td
          key={index}
          className={`px-2 py-3 text-center tabular-nums ${index === values.length - 1 ? 'border-e border-white/10' : ''} ${
            emphasize ? 'bg-[#0B3D58]' : ''
          }`}
        >
          {index % 2 === 0 ? qty(value) : money(value)}
        </td>
      ))}
    </>
  );
}
