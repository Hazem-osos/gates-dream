'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { PosAdminNav } from '@/components/pos/PosAdminNav';
import { formatMoneyAr } from '@/lib/formatMoney';

type Customer = { id: string; arabicName: string };
type Workspace = {
  customer: {
    id: string;
    arabicName: string;
    creditLimit: number | null;
    balance: number;
    ledgerBalance?: number;
    cachedBalance?: number;
  };
  availableCredit: number | null;
  balanceNote: string;
  cacheHealed?: boolean;
  creditSales: Array<{ orderId: string; orderNumber: string; amount: number; orderType: string }>;
  collections: Array<{ id: string; amount: number | string; clientRequestId?: string | null; createdAt: string }>;
};

export default function PosCreditPage() {
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [safeId, setSafeId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const customers = useApiQuery<Customer[]>(['pos-credit-customers', query], '/pos/catalog/customers', { q: query }, { enabled: query.trim().length > 0 });
  const safes = useApiQuery<Array<{ id: string; arabicName?: string }>>(['pos-credit-safes'], '/accounting/safes', { limit: 50 });
  const workspace = useApiQuery<Workspace>(['pos-credit', customerId], `/pos/admin/credit/${customerId}`, {}, { enabled: Boolean(customerId) });
  const data = workspace.data?.data;

  async function collect() {
    setError('');
    setMessage('');
    try {
      const saved = await apiClient.post<{ receipt?: { reference?: string; amount: number } }>('/pos/admin/credit/collect', {
        customerId,
        amount: Number(amount),
        safeId,
        clientRequestId: requestKey,
      });
      setMessage(`تم التحصيل ${saved.data?.receipt?.reference ?? requestKey} بمبلغ ${formatMoneyAr(saved.data?.receipt?.amount ?? Number(amount))}`);
      setRequestKey(crypto.randomUUID());
      setAmount('');
      await workspace.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحصيل');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4" dir="rtl">
      <h1 className="text-xl font-bold">آجل نقطة البيع</h1>
      <PosAdminNav />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث عميل" className="h-10 w-full rounded border px-2" />
      <div className="flex flex-wrap gap-2">
        {(customers.data?.data ?? []).map((row) => (
          <button key={row.id} type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => setCustomerId(row.id)}>{row.arabicName}</button>
        ))}
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {data ? (
        <section className="space-y-2 rounded-2xl border bg-white p-4 text-sm">
          <p className="font-semibold">{data.customer.arabicName}</p>
          <p>
            الحد {data.customer.creditLimit == null ? '—' : formatMoneyAr(data.customer.creditLimit)} · المتاح{' '}
            {data.availableCredit == null ? '—' : formatMoneyAr(data.availableCredit)} · الرصيد المحاسبي{' '}
            {formatMoneyAr(data.customer.ledgerBalance ?? data.customer.balance)}
          </p>
          <p className="text-slate-500">{data.balanceNote}</p>
          {data.cacheHealed ? (
            <p className="text-xs text-amber-700">تم تصحيح الرصيد المخزن تلقائياً ليطابق الدفتر.</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Link className="text-sky-800" href={`/accounting/cards/customer?id=${data.customer.id}`}>بطاقة العميل</Link>
            <Link className="text-sky-800" href="/accounting/account-reports/credit/account-balances">كشف الحساب</Link>
          </div>
          <h2 className="font-semibold">مبيعات آجلة</h2>
          {data.creditSales.map((row) => <p key={row.orderId}>{row.orderNumber} · {row.orderType} · {formatMoneyAr(row.amount)}</p>)}
          <h2 className="font-semibold">تحصيلات</h2>
          {data.collections.map((row) => <p key={row.id}>{row.clientRequestId || row.id} · {formatMoneyAr(Number(row.amount))}</p>)}
          <div className="flex gap-2">
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="مبلغ جزئي" className="h-10 rounded border px-2" />
            <select value={safeId} onChange={(event) => setSafeId(event.target.value)} className="h-10 rounded border px-2">
              <option value="">الخزنة</option>
              {(safes.data?.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.arabicName}</option>)}
            </select>
            <button type="button" className="rounded bg-slate-900 px-3 text-white" onClick={() => void collect()}>تحصيل</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
