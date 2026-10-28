'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ShieldCheck } from 'lucide-react';
import { useUsers } from '@/lib/platform-admin/hooks';
import { fmtMinutes, fmtRelative, isOnline } from '@/lib/platform-admin/format';
import { Badge, EmptyState, ErrorBox, Input, Pager, Select, Spinner, Table } from './ui';
import { UserRowActions } from './UserActions';

export function UsersTable({ companyId, showCompany = true }: { companyId?: string; showCompany?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, isFetching } = useUsers({ page, pageSize: 20, search: search || undefined, status, companyId });

  const head = [
    'المستخدم',
    ...(showCompany ? ['الشركة'] : []),
    'الحالة',
    'آخر ظهور',
    'آخر دخول',
    'الاستخدام (30 يوماً)',
    'إجراءات',
  ];

  return (
    <>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pr-9"
            placeholder="بحث بالاسم أو البريد أو اسم المستخدم أو الهاتف"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">كل المستخدمين</option>
          <option value="active">المفعّلون</option>
          <option value="inactive">الموقوفون</option>
        </Select>
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState title="لا يوجد مستخدمون مطابقون" />
      ) : (
        <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
          <Table head={head}>
            {data.rows.map((u) => {
              const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
              return (
                <tr key={u.id} className="hover:bg-[#F8FCFE]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-1.5 font-bold text-[#0A3D5E] hover:text-brand">
                      {name}
                      {u.isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-brand" aria-label="مدير الشركة" />}
                    </Link>
                    <p className="text-xs text-slate-500" dir="ltr">{u.email}</p>
                  </td>
                  {showCompany && (
                    <td className="px-4 py-3 text-xs">
                      <Link href={`/admin/companies/${u.company.id}`} className="font-semibold text-[#0A3D5E] hover:text-brand">{u.company.arabicName}</Link>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {u.isActive ? <Badge tone="green" dot>مفعّل</Badge> : <Badge tone="red" dot>موقوف</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {isOnline(u.lastSeenAt) ? <Badge tone="green" dot>متصل الآن</Badge> : <span className="text-slate-500">{fmtRelative(u.lastSeenAt)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.lastLoginAt ? fmtRelative(u.lastLoginAt) : 'لم يسجل دخول'}
                    {u.loginCount > 0 && <p className="text-[11px] text-slate-400">{u.loginCount} مرة</p>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-semibold text-[#0A3D5E]">{fmtMinutes(u.activeMinutesLast30Days)}</span>
                    <p className="text-[11px] text-slate-500">{u.activeDaysLast30Days} يوم عمل</p>
                  </td>
                  <td className="px-4 py-3">
                    <UserRowActions user={u} />
                  </td>
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
