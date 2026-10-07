'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export default function PayrollCompensationPage() {
  const qc = useQueryClient();
  const [employmentId, setEmploymentId] = useState('');
  const [payComponentId, setPayComponentId] = useState('');
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');

  const components = useQuery({
    queryKey: ['hcm-pay-components'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; code: string; arabicName: string }>>(
        '/hr/payroll/components'
      );
      return res.data ?? [];
    },
  });

  const list = useQuery({
    queryKey: ['compensation-components', employmentId],
    enabled: Boolean(employmentId),
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{
          id: string;
          code: string;
          name: string;
          amount: number | null;
          effectiveFrom: string;
          effectiveTo: string | null;
        }>
      >(`/hr/payroll/employment/${employmentId}/compensation-components`);
      return res.data ?? [];
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/hr/payroll/employment/${employmentId}/compensation-components`, {
        payComponentId,
        amount: Number(amount),
        effectiveFrom,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compensation-components', employmentId] });
    },
  });

  const change = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/hr/payroll/employment/${employmentId}/compensation-components/change`, {
        payComponentId,
        amount: Number(amount),
        effectiveFrom,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compensation-components', employmentId] });
    },
  });

  const rows = list.data ?? [];
  const now = new Date();
  const current = rows.filter((r) => !r.effectiveTo || new Date(r.effectiveTo) >= now);
  const future = rows.filter((r) => new Date(r.effectiveFrom) > now);
  const historical = rows.filter(
    (r) => r.effectiveTo && new Date(r.effectiveTo) < now
  );

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">تعويضات الموظف (HcmCompensationComponentAssignment)</h1>
      <p className="text-sm text-muted-foreground">
        أدخل معرّف التوظيف (employmentId) من Employee 360 — لا يُستبدل سجل التعويض القديم عند التغيير.
      </p>
      <input
        className="border rounded px-2 py-1 w-full max-w-md"
        placeholder="employmentId"
        value={employmentId}
        onChange={(e) => setEmploymentId(e.target.value)}
      />

      <section className="border rounded p-4 space-y-3 text-sm">
        <h2 className="font-semibold">إضافة / تغيير بمفعول مستقبلي</h2>
        <select className="border rounded px-2 py-1" value={payComponentId} onChange={(e) => setPayComponentId(e.target.value)}>
          <option value="">مكون</option>
          {(components.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.arabicName}</option>
          ))}
        </select>
        <input className="border rounded px-2 py-1" placeholder="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="border rounded px-2 py-1" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" className="rounded border px-3 py-1" disabled={!employmentId || assign.isPending} onClick={() => assign.mutate()}>
            تعيين جديد
          </button>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={!employmentId || change.isPending} onClick={() => change.mutate()}>
            تغيير (إغلاق السابق)
          </button>
        </div>
      </section>

      {employmentId && (
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          {(
            [
              { title: 'الحالي', group: current },
              { title: 'المستقبل', group: future },
              { title: 'التاريخي', group: historical },
            ] as const
          ).map(({ title, group }) => (
            <div key={title} className="border rounded p-3">
              <h3 className="font-medium mb-2">{title}</h3>
              <ul className="space-y-2">
                {group.map((r) => (
                  <li key={r.id} className="text-xs border-t pt-2">
                    <div>{r.code} — {r.name}</div>
                    <div>{r.amount != null ? r.amount.toLocaleString() : '—'}</div>
                    <div className="text-muted-foreground">
                      {r.effectiveFrom} → {r.effectiveTo ?? 'مفتوح'}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
