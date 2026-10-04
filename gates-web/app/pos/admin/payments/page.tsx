'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { PosAdminNav } from '@/components/pos/PosAdminNav';

type Method = {
  id: string | null;
  code: string;
  displayName: string;
  settlementType: 'CASH' | 'BANK' | 'CREDIT';
  isActive: boolean;
  safeId?: string | null;
  bankAccountId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  sortOrder?: number;
  captureMode?: string;
  builtIn?: boolean;
};
type Named = { id: string; arabicName?: string; name?: string; code?: string };

export default function PosPaymentsAdminPage() {
  const methods = useApiQuery<Method[]>(['pos-methods-admin'], '/pos/payment-methods', { activeOnly: 'false' });
  const safes = useApiQuery<Named[]>(['pos-safes'], '/accounting/safes', { limit: 100 });
  const banks = useApiQuery<Named[]>(['pos-banks'], '/accounting/bank-accounts', { limit: 100 });
  const terminals = useApiQuery<Named[]>(['pos-terminals-admin'], '/pos/terminals', { includeInactive: 'true' });
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    displayName: '',
    settlementType: 'CASH' as Method['settlementType'],
    captureMode: 'MANUAL',
    safeId: '',
    bankAccountId: '',
    branchId: '',
    terminalId: '',
    sortOrder: '10',
  });

  async function createMethod() {
    setError('');
    try {
      await apiClient.post('/pos/payment-methods', {
        code: form.code,
        displayName: form.displayName,
        settlementType: form.settlementType,
        captureMode: form.captureMode,
        safeId: form.safeId || null,
        bankAccountId: form.bankAccountId || null,
        branchId: form.branchId || null,
        terminalId: form.terminalId || null,
        sortOrder: Number(form.sortOrder) || 0,
      });
      await methods.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError('');
    try {
      await apiClient.put(`/pos/payment-methods/${id}`, body);
      await methods.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التعديل');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4" dir="rtl">
      <h1 className="text-xl font-bold">طرق الدفع</h1>
      <PosAdminNav />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <section className="grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-2">
        <input placeholder="الرمز" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="h-10 rounded border px-2" />
        <input placeholder="الاسم" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className="h-10 rounded border px-2" />
        <select value={form.settlementType} onChange={(event) => setForm({ ...form, settlementType: event.target.value as Method['settlementType'] })} className="h-10 rounded border px-2">
          <option value="CASH">نقدي</option>
          <option value="BANK">بنك</option>
          <option value="CREDIT">آجل</option>
        </select>
        <select value={form.captureMode} onChange={(event) => setForm({ ...form, captureMode: event.target.value })} className="h-10 rounded border px-2">
          <option value="MANUAL">يدوي</option>
          <option value="TERMINAL">جهاز دفع</option>
        </select>
        <select value={form.safeId} onChange={(event) => setForm({ ...form, safeId: event.target.value })} className="h-10 rounded border px-2">
          <option value="">الخزنة</option>
          {(safes.data?.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.arabicName || row.name || row.code}</option>)}
        </select>
        <select value={form.bankAccountId} onChange={(event) => setForm({ ...form, bankAccountId: event.target.value })} className="h-10 rounded border px-2">
          <option value="">الحساب البنكي</option>
          {(banks.data?.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.arabicName || row.name || row.code}</option>)}
        </select>
        <select value={form.terminalId} onChange={(event) => setForm({ ...form, terminalId: event.target.value })} className="h-10 rounded border px-2">
          <option value="">كل الأجهزة</option>
          {(terminals.data?.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.name || row.code}</option>)}
        </select>
        <input placeholder="الترتيب" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} className="h-10 rounded border px-2" />
        <button type="button" className="h-10 rounded-lg bg-slate-900 text-white" onClick={() => void createMethod()}>إضافة</button>
      </section>
      {(methods.data?.data ?? []).map((method) => (
        <article key={method.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3 text-sm">
          <div>
            <p className="font-semibold">{method.displayName} · {method.code}</p>
            <p className="text-slate-500">{method.settlementType} · {method.captureMode || 'MANUAL'} · ترتيب {method.sortOrder ?? 0}</p>
            {method.builtIn ? <p className="text-amber-700">طريقة افتراضية. أنشئ سجلاً لتثبيتها.</p> : null}
          </div>
          {method.id ? (
            <button type="button" className="rounded border px-3 py-1" onClick={() => void patch(method.id!, { isActive: !method.isActive })}>
              {method.isActive ? 'إيقاف' : 'تفعيل'}
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
