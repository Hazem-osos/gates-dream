'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { printPageContent } from '@/lib/print/printHtml';

type ShareView = {
  kind: 'invoice' | 'statement';
  companyName: string;
  title: string;
  party: string;
  date: string;
  currency: string;
  netAmount: number;
  remainingAmount: number;
  lines: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<ShareView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.token;
    if (!token) return;
    void fetch(`/api/v1/public/share/${token}`)
      .then(async (res) => {
        const json = (await res.json()) as { status?: string; data?: ShareView; message?: string };
        if (!res.ok || !json.data) throw new Error(json.message || 'الرابط غير صالح');
        setData(json.data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'تعذر فتح المستند'));
  }, [params.token]);

  if (error) {
    return (
      <main className="mx-auto max-w-lg p-6 text-center" dir="rtl">
        <p className="text-rose-700">{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto max-w-lg p-6 text-center" dir="rtl">
        جاري التحميل…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 text-[#062A3A]" dir="rtl" data-print-root="">
      <p className="text-xs text-slate-500">{data.companyName}</p>
      <h1 className="mt-1 text-2xl font-black">{data.title}</h1>
      <p className="mt-1 text-sm">{data.party}</p>
      <p className="text-sm text-slate-600">{new Date(data.date).toLocaleDateString('ar-EG')}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-slate-500">الإجمالي</p>
          <p className="font-bold">{money(data.netAmount, data.currency)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-slate-500">المتبقي</p>
          <p className="font-bold">{money(data.remainingAmount, data.currency)}</p>
        </div>
      </div>
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-b text-right text-slate-500">
            <th className="py-2">البيان</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, index) => (
            <tr key={`${line.description}-${index}`} className="border-b border-slate-100">
              <td className="py-2">{line.description}</td>
              <td>{line.quantity}</td>
              <td>{money(line.unitPrice, data.currency)}</td>
              <td>{money(line.lineTotal, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="mt-6 rounded-lg bg-[#0E79AA] px-4 py-2 text-sm font-bold text-white print:hidden"
        onClick={() => void printPageContent(data.title)}
      >
        طباعة / حفظ PDF
      </button>
    </main>
  );
}
