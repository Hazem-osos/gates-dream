'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAudit } from '@/lib/platform-admin/hooks';
import { auditLabel, fmtDateTime } from '@/lib/platform-admin/format';
import { Badge, EmptyState, ErrorBox, Pager, Select, Spinner, Table } from './ui';

const ACTION_FILTERS = [
  { value: '', label: 'كل العمليات' },
  { value: 'company.', label: 'الشركات' },
  { value: 'license.', label: 'التراخيص' },
  { value: 'user.', label: 'المستخدمون' },
  { value: 'platform.', label: 'إعدادات المنصة' },
  { value: 'admin.', label: 'دخول وإدارة المديرين' },
];

function summarize(details: Record<string, unknown> | null): string {
  if (!details) return '';
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && typeof v !== 'object')
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(' · ');
}

export function AuditTable({ companyId, targetId }: { companyId?: string; targetId?: string }) {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, isLoading, error } = useAudit({ page, pageSize: 30, action: action || undefined, companyId, targetId });

  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          {ACTION_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </Select>
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState title="لا توجد عمليات مسجّلة" />
      ) : (
        <>
          <Table head={['الوقت', 'العملية', 'بواسطة', 'الهدف', 'التفاصيل', 'IP']}>
            {data.rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-[#F8FCFE]">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDateTime(r.at)}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-[#0A3D5E]">{auditLabel(r.action)}</span>
                  {r.action === 'admin.login_failed' && <Badge tone="red">تنبيه</Badge>}
                </td>
                <td className="px-4 py-3 text-xs" dir="ltr">{r.adminEmail}</td>
                <td className="px-4 py-3 text-xs">
                  {r.targetType === 'user' && r.targetId ? (
                    <Link className="text-brand hover:underline" href={`/admin/users/${r.targetId}`}>مستخدم</Link>
                  ) : r.targetCompanyId ? (
                    <Link className="text-brand hover:underline" href={`/admin/companies/${r.targetCompanyId}`}>شركة</Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="max-w-[320px] px-4 py-3 text-[11px] text-slate-500" dir="ltr">{summarize(r.details)}</td>
                <td className="px-4 py-3 text-[11px] text-slate-400" dir="ltr">{r.ip ?? '—'}</td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
