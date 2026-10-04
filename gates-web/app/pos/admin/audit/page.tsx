'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { PosAdminNav } from '@/components/pos/PosAdminNav';

type AuditRow = {
  id: string;
  actorId?: string | null;
  at: string;
  subjectId: string;
  subjectType: string;
  reason?: string | null;
  metadata?: {
    action?: string;
    userName?: string;
    terminalId?: string | null;
    shiftId?: string | null;
    reason?: string | null;
    approverId?: string | null;
    before?: unknown;
    after?: unknown;
  } | null;
};

export default function PosAuditPage() {
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const rows = useApiQuery<AuditRow[]>(
    ['pos-audit', action, userId, terminalId, shiftId, documentId, from, to],
    '/pos/admin/audit',
    {
      action: action || undefined,
      userId: userId || undefined,
      terminalId: terminalId || undefined,
      shiftId: shiftId || undefined,
      documentId: documentId || undefined,
      from: from || undefined,
      to: to || undefined,
    }
  );

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-4" dir="rtl">
      <h1 className="text-xl font-bold">تدقيق نقطة البيع</h1>
      <PosAdminNav />
      <div className="grid gap-2 md:grid-cols-3">
        <input placeholder="من" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded border px-2" />
        <input placeholder="إلى" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded border px-2" />
        <input placeholder="الإجراء" value={action} onChange={(event) => setAction(event.target.value)} className="h-10 rounded border px-2" />
        <input placeholder="المستخدم" value={userId} onChange={(event) => setUserId(event.target.value)} className="h-10 rounded border px-2" />
        <input placeholder="الجهاز" value={terminalId} onChange={(event) => setTerminalId(event.target.value)} className="h-10 rounded border px-2" />
        <input placeholder="الوردية" value={shiftId} onChange={(event) => setShiftId(event.target.value)} className="h-10 rounded border px-2" />
        <input placeholder="المستند" value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="h-10 rounded border px-2" />
      </div>
      {(rows.data?.data ?? []).map((row) => (
        <article key={row.id} className="rounded-xl border bg-white p-3 text-sm">
          <p className="font-semibold">{row.metadata?.action} · {row.metadata?.userName || row.actorId}</p>
          <p>{new Date(row.at).toLocaleString('ar-EG')} · {row.subjectType} · {row.subjectId}</p>
          <p>جهاز {row.metadata?.terminalId || '—'} · وردية {row.metadata?.shiftId || '—'}</p>
          <p>السبب {row.metadata?.reason || row.reason || '—'}</p>
          <p>المعتمد {row.metadata?.approverId || '—'}</p>
          <p className="truncate text-slate-500">قبل {JSON.stringify(row.metadata?.before ?? null)} · بعد {JSON.stringify(row.metadata?.after ?? null)}</p>
        </article>
      ))}
    </div>
  );
}
