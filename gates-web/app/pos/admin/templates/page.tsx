'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { PosAdminNav } from '@/components/pos/PosAdminNav';

type Template = { id: string; name: string; isActive: boolean };

export default function PosShiftTemplatesPage() {
  const rows = useApiQuery<Template[]>(['pos-shift-templates'], '/pos/admin/templates');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4" dir="rtl">
      <h1 className="text-xl font-bold">قوالب الورديات</h1>
      <PosAdminNav />
      <p className="text-sm text-slate-600">القالب اسم فقط. جلسة التشغيل تبقى PosShift ولا تتغير معناها.</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="صباحية" className="h-10 flex-1 rounded border px-2" />
        <button
          type="button"
          className="rounded bg-slate-900 px-4 text-white"
          onClick={() => {
            setError('');
            void apiClient.post('/pos/admin/templates', { name }).then(() => rows.refetch()).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'تعذر الحفظ');
            });
          }}
        >
          إضافة
        </button>
      </div>
      {(rows.data?.data ?? []).map((row) => (
        <article key={row.id} className="flex items-center justify-between rounded-xl border bg-white p-3 text-sm">
          <span>{row.name}</span>
          <button type="button" className="rounded border px-3 py-1" onClick={() => void apiClient.put(`/pos/admin/templates/${row.id}`, { isActive: !row.isActive }).then(() => rows.refetch())}>
            {row.isActive ? 'إيقاف' : 'تفعيل'}
          </button>
        </article>
      ))}
    </div>
  );
}
