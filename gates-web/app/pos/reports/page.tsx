'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatMoneyAr } from '@/lib/formatMoney';

type Report = {
  byCashier: Array<{ cashierId: string; net: number; orders: number }>;
  byItem: Array<{ itemId: string; name: string; quantity: number; net: number }>;
  byCategory: Array<{ name: string; quantity: number; net: number }>;
  byPaymentMethod: Array<{ method: string; label: string; amount: number }>;
  returns: { count: number; net: number };
  bySession: Array<{ shiftId: string; terminalName: string; cashierId: string | null; net: number; orders: number; returns: number }>;
  closes: Array<{ terminalName: string; variance: number; netSales: number; countedCash: number; expectedCash: number }>;
  totals?: { gross: number; net: number; tax: number; discount: number; cogs: number; grossProfit: number; margin: number | null };
  byHour?: Array<{ hour: string; net: number; orders: number }>;
  byCustomer?: Array<{ name: string; net: number }>;
  byTerminal?: Array<{ name: string; net: number }>;
  byBranch?: Array<{ name: string; net: number }>;
  returnReasons?: Array<{ reason: string; count: number; net: number }>;
  gifts?: { lines: number; quantity: number };
  voids?: Array<{ orderNumber: string; reason: string | null; net: number }>;
  creditSales?: number;
  cashMovements?: Array<{ type: string; amount: number; reason: string }>;
  paymentReconciliation?: Array<{ status: string; amount: number }>;
  varianceTotal?: number;
};

export default function PosReportsPage() {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const report = useApiQuery<Report>(
    ['pos-retail-report', from, to],
    '/pos/reports',
    { from, to },
    { enabled: Boolean(from && to) }
  );
  const data = report.data?.data;

  return (
    <div className="mx-auto max-w-5xl p-4" dir="rtl">
      <h1 className="mb-3 text-xl font-bold">تقارير نقطة البيع</h1>
      <p className="mb-3 text-sm text-slate-600">من أوامر نقطة البيع المرحلة فقط.</p>
      <div className="mb-4 flex gap-2">
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-lg border px-2" />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-lg border px-2" />
      </div>
      {report.isLoading ? <p className="text-sm text-slate-500">جاري التحميل…</p> : null}
      {report.isError ? <p className="text-sm text-rose-700">تعذر تحميل التقرير</p> : null}
      {data ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card title="حسب الكاشير" rows={data.byCashier.map((row) => [row.cashierId, formatMoneyAr(row.net), String(row.orders)])} />
          <Card title="حسب الصنف" rows={data.byItem.map((row) => [row.name, formatMoneyAr(row.net), String(row.quantity)])} />
          <Card title="حسب التصنيف" rows={data.byCategory.map((row) => [row.name, formatMoneyAr(row.net), String(row.quantity)])} />
          <Card title="طرق الدفع" rows={data.byPaymentMethod.map((row) => [row.label, formatMoneyAr(row.amount), row.method])} />
          <Card title="المرتجعات" rows={[[`${data.returns.count} مرتجع`, formatMoneyAr(data.returns.net), '']]} />
          <Card title="الورديات" rows={data.bySession.map((row) => [row.terminalName, formatMoneyAr(row.net), `${row.orders} بيع / ${row.returns} مرتجع`])} />
          <Card title="لقطات الإقفال" rows={data.closes.map((row) => [row.terminalName, formatMoneyAr(row.variance), `صافي ${formatMoneyAr(row.netSales)}`])} />
          <Card title="الإجمالي" rows={data.totals ? [[`صافي ${formatMoneyAr(data.totals.net)}`, `ربح ${formatMoneyAr(data.totals.grossProfit)}`, data.totals.margin == null ? '' : `${data.totals.margin}%`]] : []} />
          <Card title="حسب الساعة" rows={(data.byHour ?? []).map((row) => [row.hour, formatMoneyAr(row.net), String(row.orders)])} />
          <Card title="حسب العميل" rows={(data.byCustomer ?? []).map((row) => [row.name, formatMoneyAr(row.net), ''])} />
          <Card title="حسب الجهاز" rows={(data.byTerminal ?? []).map((row) => [row.name, formatMoneyAr(row.net), ''])} />
          <Card title="حسب الفرع" rows={(data.byBranch ?? []).map((row) => [row.name, formatMoneyAr(row.net), ''])} />
          <Card title="أسباب المرتجع" rows={(data.returnReasons ?? []).map((row) => [row.reason, formatMoneyAr(row.net), String(row.count)])} />
          <Card title="الهدايا" rows={[[`${data.gifts?.lines ?? 0} سطر`, String(data.gifts?.quantity ?? 0), '']]} />
          <Card title="الإلغاءات" rows={(data.voids ?? []).map((row) => [row.orderNumber, formatMoneyAr(row.net), row.reason ?? ''])} />
          <Card title="الآجل" rows={[[formatMoneyAr(data.creditSales ?? 0), '', '']]} />
          <Card title="حركة النقد" rows={(data.cashMovements ?? []).map((row) => [row.type, formatMoneyAr(row.amount), row.reason])} />
          <Card title="تسوية الدفع" rows={(data.paymentReconciliation ?? []).map((row) => [row.status, formatMoneyAr(row.amount), ''])} />
          <Card title="مجموع الفرق" rows={[[formatMoneyAr(data.varianceTotal ?? 0), '', '']]} />
        </div>
      ) : null}
    </div>
  );
}

function Card({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="rounded-2xl border bg-white p-3">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-slate-500">لا توجد حركة</p> : null}
      {rows.map((row, index) => (
        <div key={`${title}-${index}`} className="flex justify-between gap-2 border-b border-slate-100 py-1 text-sm">
          <span className="truncate">{row[0]}</span>
          <span className="font-semibold">{row[1]}</span>
          <span className="text-slate-500">{row[2]}</span>
        </div>
      ))}
    </section>
  );
}
