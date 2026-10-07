'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

type RunReview = {
  run: {
    id: string;
    periodYear: number;
    periodMonth: number;
    status: string;
    calculationMode: string;
    gross: number | null;
    net: number | null;
    accrualJournalEntryId?: string | null;
    paymentJournalEntryId?: string | null;
    paidAt?: string | null;
    postedAt?: string | null;
  };
  reconciliation: { balanced: boolean; blockers: string[] };
  glBlockers: string[];
  auditTimeline: Array<{ action: string; at: string; actorId?: string | null }>;
  employees: Array<{
    employeeId: string;
    name: string;
    gross: number | null;
    net: number | null;
    compensationSegments?: Array<{
      componentCode: string;
      effectiveFrom: string;
      effectiveTo: string;
      fullAmount: number;
      proratedAmount: number;
    }>;
    components: Array<{
      code: string;
      type: string;
      amount: number;
      explanation: { title: string; detail: string };
    }>;
  }>;
};

export default function PayrollRunReviewPage() {
  const params = useParams();
  const runId = String(params.id);
  const qc = useQueryClient();
  const [safeId, setSafeId] = useState('');
  const [confirmPost, setConfirmPost] = useState(false);
  const [confirmPay, setConfirmPay] = useState(false);

  const review = useQuery({
    queryKey: ['payroll-run-review', runId],
    queryFn: async () => {
      const res = await apiClient.get<RunReview>(`/hr/payroll/runs/${runId}/review`);
      return res.data;
    },
  });

  const approve = useMutation({
    mutationFn: () => apiClient.post(`/hr/payroll-runs/${runId}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-run-review', runId] }),
  });

  const post = useMutation({
    mutationFn: () => apiClient.post(`/hr/payroll-runs/${runId}/post-accrual`, {}),
    onSuccess: () => {
      setConfirmPost(false);
      qc.invalidateQueries({ queryKey: ['payroll-run-review', runId] });
    },
  });

  const unpost = useMutation({
    mutationFn: () => apiClient.post(`/hr/payroll-runs/${runId}/unpost-accrual`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-run-review', runId] }),
  });

  const disburse = useMutation({
    mutationFn: () => apiClient.post(`/hr/payroll-runs/${runId}/disburse`, { safeId }),
    onSuccess: () => {
      setConfirmPay(false);
      qc.invalidateQueries({ queryKey: ['payroll-run-review', runId] });
    },
  });

  const unpostPay = useMutation({
    mutationFn: () => apiClient.post(`/hr/payroll-runs/${runId}/unpost-disbursement`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-run-review', runId] }),
  });

  const data = review.data;
  if (review.isLoading) return <div className="p-6">جاري التحميل…</div>;
  if (!data) return <div className="p-6">لم يتم العثور على المسيرة.</div>;

  const r = data.run;
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            مسيرة {r.periodYear}-{String(r.periodMonth).padStart(2, '0')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {r.status} · {r.calculationMode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['CALCULATED', 'REVIEWED', 'DRAFT'].includes(r.status) && (
            <button
              type="button"
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              disabled={approve.isPending}
              onClick={() => approve.mutate()}
            >
              اعتماد
            </button>
          )}
          {['APPROVED', 'CALCULATED'].includes(r.status) && !confirmPost && (
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              disabled={data.glBlockers.length > 0}
              onClick={() => setConfirmPost(true)}
            >
              ترحيل
            </button>
          )}
          {confirmPost && (
            <button
              type="button"
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              disabled={post.isPending || data.glBlockers.length > 0}
              onClick={() => post.mutate()}
            >
              تأكيد الترحيل
            </button>
          )}
          {r.status === 'POSTED' && (
            <button type="button" className="rounded border px-3 py-1.5 text-sm" disabled={unpost.isPending} onClick={() => unpost.mutate()}>
              عكس الترحيل
            </button>
          )}
          {r.status === 'POSTED' && !confirmPay && (
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setConfirmPay(true)}>
              صرف
            </button>
          )}
          {confirmPay && (
            <div className="flex items-center gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="معرّف الخزينة safeId" value={safeId} onChange={(e) => setSafeId(e.target.value)} />
              <button type="button" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground" disabled={!safeId || disburse.isPending} onClick={() => disburse.mutate()}>
                تأكيد الصرف ({r.net?.toLocaleString() ?? '—'})
              </button>
            </div>
          )}
          {r.status === 'PAID' && (
            <button type="button" className="rounded border px-3 py-1.5 text-sm" disabled={unpostPay.isPending} onClick={() => unpostPay.mutate()}>
              عكس الصرف
            </button>
          )}
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4 text-sm">
        <div className="border rounded p-3">الإجمالي: {r.gross?.toLocaleString() ?? '—'}</div>
        <div className="border rounded p-3">الصافي: {r.net?.toLocaleString() ?? '—'}</div>
        <div className="border rounded p-3">
          التسوية: {data.reconciliation.balanced ? 'متوازن' : 'غير متوازن'}
        </div>
        <div className="border rounded p-3">
          قيد الترحيل:{' '}
          {r.accrualJournalEntryId ? (
            <Link className="underline" href={`/accounting/journal-entries/${r.accrualJournalEntryId}`}>
              {r.accrualJournalEntryId.slice(0, 8)}…
            </Link>
          ) : (
            'لا'
          )}
        </div>
        <div className="border rounded p-3 md:col-span-2">
          الصرف: {r.paymentJournalEntryId ? (
            <Link className="underline" href={`/accounting/journal-entries/${r.paymentJournalEntryId}`}>
              قيد الدفع
            </Link>
          ) : '—'}
          {r.paidAt && <span className="text-muted-foreground"> · {new Date(r.paidAt).toLocaleString('ar-EG')}</span>}
        </div>
      </section>

      {(data.reconciliation.blockers.length > 0 || data.glBlockers.length > 0) && (
        <div className="border border-amber-300 bg-amber-50 rounded p-3 text-sm">
          <div className="font-medium">معوقات</div>
          <ul className="list-disc pr-5">
            {[...data.reconciliation.blockers, ...data.glBlockers].map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h3 className="font-semibold mb-2">سجل الأحداث</h3>
        <ul className="text-sm space-y-1">
          {data.auditTimeline.map((e) => (
            <li key={`${e.action}-${e.at}`}>
              {e.action} — {new Date(e.at).toLocaleString('ar-EG')} — {e.actorId ?? '—'}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold mb-2">الموظفون</h3>
        <div className="space-y-4">
          {data.employees.map((emp) => (
            <div key={emp.employeeId} className="border rounded p-3">
              <div className="flex justify-between">
                <span className="font-medium">{emp.name}</span>
                <Link
                  className="text-sm underline"
                  href={`/hr/payroll/runs/${runId}/payslip/${emp.employeeId}`}
                >
                  قسيمة الراتب
                </Link>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                صافي: {emp.net?.toLocaleString() ?? '—'}
              </div>
              {(emp.compensationSegments?.length ?? 0) > 0 && (
                <div className="text-xs mb-2 border rounded p-2 bg-muted/30">
                  <div className="font-medium mb-1">شرائح التعويض (مجمدة)</div>
                  {emp.compensationSegments!.map((s, i) => (
                    <div key={i}>
                      {s.componentCode}: {s.effectiveFrom}–{s.effectiveTo} — {s.fullAmount.toLocaleString()} →{' '}
                      {s.proratedAmount.toLocaleString()}
                    </div>
                  ))}
                </div>
              )}
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-right p-1">البند</th>
                    <th className="text-right p-1">التفسير</th>
                    <th className="text-right p-1">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.components.map((c) => (
                    <tr key={c.code} className="border-t">
                      <td className="p-1">{c.explanation.title}</td>
                      <td className="p-1">{c.explanation.detail}</td>
                      <td className="p-1">{c.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
