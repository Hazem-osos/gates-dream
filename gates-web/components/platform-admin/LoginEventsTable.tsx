'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLoginEvents } from '@/lib/platform-admin/hooks';
import { fmtDateTime, LOGIN_REASON_LABEL, shortAgent } from '@/lib/platform-admin/format';
import { Badge, EmptyState, ErrorBox, Pager, Select, Spinner, Table } from './ui';

export function LoginEventsTable({
  userId,
  companyId,
  initialFilter = 'all',
  showUser = true,
}: {
  userId?: string;
  companyId?: string;
  initialFilter?: 'all' | 'success' | 'failed';
  showUser?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [success, setSuccess] = useState(initialFilter);
  const { data, isLoading, error, isFetching } = useLoginEvents({ page, pageSize: 30, userId, companyId, success });

  const head = ['الوقت', 'النتيجة', ...(showUser ? ['الحساب', 'الشركة'] : []), 'الجهاز', 'IP'];

  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select
          value={success}
          onChange={(e) => {
            setSuccess(e.target.value as typeof success);
            setPage(1);
          }}
          aria-label="تصفية النتيجة"
        >
          <option value="all">كل المحاولات</option>
          <option value="success">الناجحة فقط</option>
          <option value="failed">الفاشلة فقط</option>
        </Select>
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState title="لا توجد محاولات دخول مسجّلة" hint="التسجيل يبدأ من أول دخول بعد نشر هذه النسخة" />
      ) : (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          <Table head={head}>
            {data.rows.map((r) => {
              const name = r.user ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || r.user.email : null;
              return (
                <tr key={r.id} className="hover:bg-[#F8FCFE]">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDateTime(r.at)}</td>
                  <td className="px-4 py-3">
                    {r.success ? (
                      <Badge tone="green" dot>نجح</Badge>
                    ) : (
                      <Badge tone="red" dot>{LOGIN_REASON_LABEL[r.reason ?? 'ERROR'] ?? r.reason ?? 'فشل'}</Badge>
                    )}
                  </td>
                  {showUser && (
                    <td className="px-4 py-3 text-xs">
                      {r.userId && name ? (
                        <Link href={`/admin/users/${r.userId}`} className="font-semibold text-[#0A3D5E] hover:text-brand">{name}</Link>
                      ) : (
                        <span className="text-slate-500">حساب غير موجود</span>
                      )}
                      <p className="text-[11px] text-slate-400" dir="ltr">{r.identifier}</p>
                    </td>
                  )}
                  {showUser && (
                    <td className="px-4 py-3 text-xs">
                      {r.companyId && r.companyName ? (
                        <Link href={`/admin/companies/${r.companyId}`} className="text-[#0A3D5E] hover:text-brand">{r.companyName}</Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs text-slate-600" title={r.userAgent ?? undefined}>{shortAgent(r.userAgent)}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-500" dir="ltr">{r.ip ?? '—'}</td>
                </tr>
              );
            })}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      )}
    </>
  );
}
