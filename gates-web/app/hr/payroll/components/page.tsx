'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

type Row = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  componentType: string;
  isActive: boolean;
  priority: number;
  showOnPayslip: boolean;
  isRecurring: boolean;
};

export default function PayComponentsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({
    code: '',
    arabicName: '',
    componentType: 'EARNING',
    priority: 100,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['hcm-pay-components'],
    queryFn: async () => {
      const res = await apiClient.get<Row[]>('/hr/payroll/components');
      return res.data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      await apiClient.post('/hr/payroll/components', form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hcm-pay-components'] });
      setForm({ code: '', arabicName: '', componentType: 'EARNING', priority: 100 });
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await apiClient.patch(`/hr/payroll/components/${editing.id}`, {
        arabicName: editing.arabicName,
        priority: editing.priority,
        isActive: editing.isActive,
        showOnPayslip: editing.showOnPayslip,
        isRecurring: editing.isRecurring,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hcm-pay-components'] });
      setEditing(null);
    },
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">مكونات الراتب</h1>
      <section className="border rounded p-4 text-sm space-y-2">
        <h2 className="font-semibold">إنشاء مكون</h2>
        <div className="flex flex-wrap gap-2">
          <input className="border rounded px-2 py-1" placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="الاسم" value={form.arabicName} onChange={(e) => setForm({ ...form, arabicName: e.target.value })} />
          <select className="border rounded px-2 py-1" value={form.componentType} onChange={(e) => setForm({ ...form, componentType: e.target.value })}>
            <option value="EARNING">EARNING</option>
            <option value="DEDUCTION">DEDUCTION</option>
            <option value="EMPLOYER_CONTRIBUTION">EMPLOYER_CONTRIBUTION</option>
          </select>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={create.isPending} onClick={() => create.mutate()}>
            حفظ
          </button>
        </div>
      </section>
      {isLoading ? <p>جاري التحميل…</p> : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-right">الكود</th>
              <th className="p-2 text-right">الاسم</th>
              <th className="p-2 text-right">النوع</th>
              <th className="p-2 text-right">نشط</th>
              <th className="p-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.code}</td>
                <td className="p-2">{row.arabicName}</td>
                <td className="p-2">{row.componentType}</td>
                <td className="p-2">{row.isActive ? 'نعم' : 'لا'}</td>
                <td className="p-2">
                  <button type="button" className="underline text-xs" onClick={() => setEditing(row)}>تعديل</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background border rounded p-4 w-full max-w-md space-y-3 text-sm" dir="rtl">
            <h3 className="font-bold">تعديل {editing.code}</h3>
            <input className="border w-full rounded px-2 py-1" value={editing.arabicName} onChange={(e) => setEditing({ ...editing, arabicName: e.target.value })} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> نشط</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.showOnPayslip} onChange={(e) => setEditing({ ...editing, showOnPayslip: e.target.checked })} /> يظهر في القسيمة</label>
            <div className="flex gap-2 justify-end">
              <button type="button" className="border rounded px-3 py-1" onClick={() => setEditing(null)}>إلغاء</button>
              <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={update.isPending} onClick={() => update.mutate()}>حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
