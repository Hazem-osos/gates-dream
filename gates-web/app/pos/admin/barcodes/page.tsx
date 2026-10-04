'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { PosAdminNav } from '@/components/pos/PosAdminNav';

type Rule = {
  id: string;
  name: string;
  prefix: string;
  itemStart: number;
  itemLength: number;
  valueStart: number;
  valueLength: number;
  valueKind: string;
  decimals: number;
  isActive: boolean;
};

export default function PosBarcodeRulesPage() {
  const rules = useApiQuery<Rule[]>(['pos-barcode-rules'], '/pos/admin/barcode-rules');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', prefix: '22', itemStart: '2', itemLength: '5', valueStart: '7', valueLength: '5', valueKind: 'WEIGHT', decimals: '3' });

  async function createRule() {
    setError('');
    try {
      await apiClient.post('/pos/admin/barcode-rules', {
        name: form.name,
        prefix: form.prefix,
        itemStart: Number(form.itemStart),
        itemLength: Number(form.itemLength),
        valueStart: Number(form.valueStart),
        valueLength: Number(form.valueLength),
        valueKind: form.valueKind,
        decimals: Number(form.decimals),
      });
      await rules.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4" dir="rtl">
      <h1 className="text-xl font-bold">باركود الوزن</h1>
      <PosAdminNav />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <section className="grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-3">
        <input placeholder="الاسم" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-10 rounded border px-2" />
        <input placeholder="البادئة" value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value })} className="h-10 rounded border px-2" />
        <select value={form.valueKind} onChange={(event) => setForm({ ...form, valueKind: event.target.value })} className="h-10 rounded border px-2">
          <option value="WEIGHT">وزن</option>
          <option value="QTY">كمية</option>
          <option value="PRICE">سعر</option>
        </select>
        <button type="button" className="h-10 rounded bg-slate-900 text-white" onClick={() => void createRule()}>إضافة قاعدة</button>
      </section>
      {(rules.data?.data ?? []).map((rule) => (
        <article key={rule.id} className="flex items-center justify-between rounded-xl border bg-white p-3 text-sm">
          <p>{rule.name} · {rule.prefix} · {rule.valueKind} · {rule.decimals} خانات</p>
          <button type="button" className="rounded border px-3 py-1" onClick={() => void apiClient.put(`/pos/admin/barcode-rules/${rule.id}`, { isActive: !rule.isActive }).then(() => rules.refetch())}>
            {rule.isActive ? 'إيقاف' : 'تفعيل'}
          </button>
        </article>
      ))}
    </div>
  );
}
