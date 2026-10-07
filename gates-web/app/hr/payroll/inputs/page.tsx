'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export default function OneTimeInputsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employeeId: '',
    employmentId: '',
    payComponentId: '',
    periodYear: new Date().getUTCFullYear(),
    periodMonth: new Date().getUTCMonth() + 1,
    amount: '',
    reason: '',
  });
  const [csv, setCsv] = useState('');

  const components = useQuery({
    queryKey: ['hcm-pay-components'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; code: string }>>('/hr/payroll/components');
      return res.data ?? [];
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll-one-time-inputs'],
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{
          id: string;
          amount: string;
          periodYear: number;
          periodMonth: number;
          status: string;
          consumedRunId: string | null;
          approvedAt?: string | null;
          employee: { arabicName: string };
          payComponent: { code: string };
        }>
      >('/hr/payroll/inputs');
      return res.data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      await apiClient.post('/hr/payroll/inputs', {
        ...form,
        amount: Number(form.amount),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-one-time-inputs'] }),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/hr/payroll/inputs/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-one-time-inputs'] }),
  });

  const bulk = useMutation({
    mutationFn: async () => {
      const lines = csv.trim().split('\n').filter(Boolean);
      const rows = lines.map((line) => {
        const [employeeId, payComponentId, periodYear, periodMonth, amount, reason] = line.split(',');
        return {
          employeeId: employeeId.trim(),
          payComponentId: payComponentId.trim(),
          periodYear: Number(periodYear),
          periodMonth: Number(periodMonth),
          amount: Number(amount),
          reason: reason?.trim(),
        };
      });
      const res = await apiClient.post<{ results: Array<{ index: number; ok: boolean; error?: string }> }>(
        '/hr/payroll/inputs/bulk',
        { rows }
      );
      return res.data?.results ?? [];
    },
  });

  if (isLoading) return <div className="p-6">جاري التحميل…</div>;
  if (error) return <div className="p-6 text-destructive">لا تملك صلاحية inputs_manage أو حدث خطأ.</div>;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h2 className="text-xl font-bold">مدخلات لمرة واحدة</h2>
      <section className="border rounded p-4 text-sm space-y-2">
        <h3 className="font-semibold">إنشاء</h3>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" placeholder="employeeId" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="employmentId" value={form.employmentId} onChange={(e) => setForm({ ...form, employmentId: e.target.value })} />
          <select className="border rounded px-2 py-1" value={form.payComponentId} onChange={(e) => setForm({ ...form, payComponentId: e.target.value })}>
            <option value="">مكون</option>
            {(components.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>
          <input className="border rounded px-2 py-1" type="number" placeholder="سنة" value={form.periodYear} onChange={(e) => setForm({ ...form, periodYear: Number(e.target.value) })} />
          <input className="border rounded px-2 py-1" type="number" placeholder="شهر" value={form.periodMonth} onChange={(e) => setForm({ ...form, periodMonth: Number(e.target.value) })} />
          <input className="border rounded px-2 py-1" placeholder="المبلغ" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <input className="border rounded px-2 py-1 w-full" placeholder="السبب" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={create.isPending} onClick={() => create.mutate()}>
          حفظ كمسودة
        </button>
      </section>
      <section className="border rounded p-4 text-sm space-y-2">
        <h3 className="font-semibold">استيراد CSV</h3>
        <p className="text-xs text-muted-foreground">employeeId,payComponentId,year,month,amount,reason</p>
        <textarea className="border w-full rounded p-2 font-mono text-xs" rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} />
        <button type="button" className="rounded border px-3 py-1" disabled={bulk.isPending} onClick={() => bulk.mutate()}>
          استيراد
        </button>
        {bulk.data && (
          <ul className="text-xs">
            {bulk.data.map((r) => (
              <li key={r.index}>{r.ok ? `صف ${r.index}: OK` : `صف ${r.index}: ${r.error}`}</li>
            ))}
          </ul>
        )}
      </section>
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-right">الموظف</th>
            <th className="p-2 text-right">المكون</th>
            <th className="p-2 text-right">الفترة</th>
            <th className="p-2 text-right">المبلغ</th>
            <th className="p-2 text-right">الحالة</th>
            <th className="p-2 text-right" />
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id} className="border-t">
              <td className="p-2">{row.employee.arabicName}</td>
              <td className="p-2">{row.payComponent.code}</td>
              <td className="p-2">{row.periodYear}-{row.periodMonth}</td>
              <td className="p-2">{Number(row.amount).toLocaleString()}</td>
              <td className="p-2">{row.status}{row.consumedRunId ? ' (مستهلك)' : ''}</td>
              <td className="p-2">
                {row.status === 'DRAFT' && (
                  <button type="button" className="underline text-xs" onClick={() => approve.mutate(row.id)}>اعتماد</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
