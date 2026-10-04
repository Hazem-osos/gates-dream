'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { PosAdminNav } from '@/components/pos/PosAdminNav';
import type { PosTerminal } from '@/lib/hooks/usePosSession';

type Named = { id: string; arabicName?: string; name?: string };

export default function PosTerminalsAdminPage() {
  const terminals = useApiQuery<PosTerminal[]>(['pos-terminals-all'], '/pos/terminals', { includeInactive: 'true' });
  const branches = useApiQuery<Named[]>(['pos-branches'], '/company/branches');
  const warehouses = useApiQuery<Named[]>(['pos-warehouses'], '/inventory/warehouses', { limit: 100 });
  const safes = useApiQuery<Named[]>(['pos-safes-term'], '/accounting/safes', { limit: 100 });
  const banks = useApiQuery<Named[]>(['pos-banks-term'], '/accounting/bank-accounts', { limit: 100 });
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', deviceCode: '', branchId: '', warehouseId: '', safeId: '', bankAccountId: '', receiptFooter: '', offlineEnabled: false });

  async function createTerminal() {
    setError('');
    try {
      await apiClient.post('/pos/terminals', {
        name: form.name,
        deviceCode: form.deviceCode || undefined,
        branchId: form.branchId,
        warehouseId: form.warehouseId,
        safeId: form.safeId,
        bankAccountId: form.bankAccountId || undefined,
      });
      await terminals.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الجهاز');
    }
  }

  async function save(row: PosTerminal, patch: Record<string, unknown>) {
    setError('');
    try {
      await apiClient.put(`/pos/terminals/${row.id}`, patch);
      await terminals.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التعديل');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4" dir="rtl">
      <h1 className="text-xl font-bold">أجهزة نقطة البيع</h1>
      <PosAdminNav />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <section className="grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-2">
        <input placeholder="الاسم" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-10 rounded border px-2" />
        <input placeholder="رمز الجهاز" value={form.deviceCode} onChange={(event) => setForm({ ...form, deviceCode: event.target.value })} className="h-10 rounded border px-2" />
        <Select label="الفرع" value={form.branchId} options={branches.data?.data ?? []} onChange={(branchId) => setForm({ ...form, branchId })} />
        <Select label="المخزن" value={form.warehouseId} options={warehouses.data?.data ?? []} onChange={(warehouseId) => setForm({ ...form, warehouseId })} />
        <Select label="الخزنة" value={form.safeId} options={safes.data?.data ?? []} onChange={(safeId) => setForm({ ...form, safeId })} />
        <Select label="البنك" value={form.bankAccountId} options={banks.data?.data ?? []} onChange={(bankAccountId) => setForm({ ...form, bankAccountId })} />
        <button type="button" className="h-10 rounded-lg bg-slate-900 text-white" onClick={() => void createTerminal()}>إضافة جهاز</button>
      </section>
      {(terminals.data?.data ?? []).map((row) => (
        <article key={row.id} className="space-y-2 rounded-xl border bg-white p-3 text-sm">
          <p className="font-semibold">{row.name} {row.deviceCode ? `· ${row.deviceCode}` : ''}</p>
          <p>{row.shifts?.length ? `وردية مفتوحة منذ ${new Date(row.shifts[0].openedAt).toLocaleString('ar-EG')}` : 'لا توجد وردية مفتوحة'}</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked={row.offlineEnabled} onChange={(event) => void save(row, { offlineEnabled: event.target.checked })} />
            مزامنة دون اتصال
          </label>
          <input defaultValue={row.receiptFooter ?? ''} placeholder="تذييل الإيصال" className="h-10 w-full rounded border px-2" onBlur={(event) => void save(row, { receiptFooter: event.target.value || null })} />
          <button type="button" className="rounded border px-3 py-1" disabled={Boolean(row.shifts?.length) && row.isActive !== false} onClick={() => void save(row, { isActive: row.isActive === false })}>
            {row.isActive === false ? 'تفعيل' : 'إيقاف'}
          </button>
        </article>
      ))}
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Named[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded border px-2">
      <option value="">{label}</option>
      {options.map((row) => <option key={row.id} value={row.id}>{row.arabicName || row.name}</option>)}
    </select>
  );
}
