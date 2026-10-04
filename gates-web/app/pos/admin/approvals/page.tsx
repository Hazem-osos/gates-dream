'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { PosAdminNav } from '@/components/pos/PosAdminNav';
import { useResourcePermissions } from '@/lib/hooks/useResourcePermissions';

type Approval = {
  id: string;
  action: string;
  status: string;
  requesterId: string;
  approverId?: string | null;
  reason: string;
  shiftId?: string | null;
  orderId?: string | null;
  payload?: unknown;
  createdAt: string;
};

export default function PosApprovalsPage() {
  const [status, setStatus] = useState('PENDING');
  const [error, setError] = useState('');
  const rows = useApiQuery<Approval[]>(['pos-approvals', status], '/pos/admin/approvals', { status });
  const permissions = useResourcePermissions({ resource: 'pos', module: 'pos' });

  async function decide(id: string, accept: boolean) {
    setError('');
    try {
      await apiClient.post(`/pos/admin/approvals/${id}/decide`, { accept });
      await rows.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحسم');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3 p-4" dir="rtl">
      <h1 className="text-xl font-bold">موافقات نقطة البيع</h1>
      <PosAdminNav />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded border px-2">
        <option value="PENDING">معلقة</option>
        <option value="APPROVED">معتمدة</option>
        <option value="REJECTED">مرفوضة</option>
        <option value="CONSUMED">مستخدمة</option>
      </select>
      {(rows.data?.data ?? []).map((row) => (
        <article key={row.id} className="rounded-xl border bg-white p-3 text-sm">
          <p className="font-semibold">{row.action} · {row.status}</p>
          <p>الطالب {row.requesterId} · {new Date(row.createdAt).toLocaleString('ar-EG')}</p>
          <p>السبب {row.reason}</p>
          <p>أمر {row.orderId || '—'} · وردية {row.shiftId || '—'}</p>
          <p className="truncate text-slate-500">{JSON.stringify(row.payload ?? {})}</p>
          {row.status === 'PENDING' && permissions.can('approve') ? (
            <div className="mt-2 flex gap-2">
              <button type="button" className="rounded bg-slate-900 px-3 py-1 text-white" onClick={() => void decide(row.id, true)}>اعتماد</button>
              <button type="button" className="rounded border px-3 py-1" onClick={() => void decide(row.id, false)}>رفض</button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
