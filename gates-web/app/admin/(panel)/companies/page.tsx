'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Sparkles } from 'lucide-react';
import { useCompanies } from '@/lib/platform-admin/hooks';
import {
  fmtDate,
  fmtMinutes,
  fmtRelative,
  isOnline,
  LICENSE_STATE_LABEL,
  LICENSE_STATE_TONE,
} from '@/lib/platform-admin/format';
import { Badge, Button, Card, EmptyState, ErrorBox, Input, PageHeader, Pager, Select, Spinner, Table } from '@/components/platform-admin/ui';
import { CreateCompanyDialog } from '@/components/platform-admin/Dialogs';

export default function PlatformCompaniesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [license, setLicense] = useState('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error, isFetching } = useCompanies({ page, pageSize: 20, search: search || undefined, status, license });

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="الشركات"
        subtitle="كل العملاء على المنصة: المستخدمون، النشاط، الترخيص والذكاء الاصطناعي"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>شركة جديدة</Button>}
      />

      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pr-9" placeholder="بحث بالاسم أو الرقم أو البريد أو الهاتف" value={search} onChange={(e) => reset(() => setSearch(e.target.value))} />
          </div>
          <Select value={status} onChange={(e) => reset(() => setStatus(e.target.value))}>
            <option value="all">كل الحالات</option>
            <option value="active">مفعّلة</option>
            <option value="inactive">موقوفة</option>
          </Select>
          <Select value={license} onChange={(e) => reset(() => setLicense(e.target.value))}>
            <option value="all">كل التراخيص</option>
            <option value="active">ترخيص مفعّل</option>
            <option value="trial">تجريبي</option>
            <option value="expiring">ينتهي خلال 30 يوماً</option>
            <option value="expired">منتهي</option>
            <option value="suspended">موقوف</option>
            <option value="unlicensed">بدون ترخيص</option>
          </Select>
        </div>

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox error={error} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState title="لا توجد شركات مطابقة" />
        ) : (
          <div className={isFetching ? 'opacity-70 transition' : 'transition'}>
            <Table head={['الشركة', 'الحالة', 'الترخيص', 'المستخدمون', 'النشاط (7 أيام)', 'آخر نشاط', 'الذكاء الاصطناعي', 'تاريخ الإنشاء']}>
              {data.rows.map((c) => (
                <tr key={c.id} className="hover:bg-[#F8FCFE]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/companies/${c.id}`} className="font-bold text-[#0A3D5E] hover:text-brand">{c.arabicName}</Link>
                    <p className="text-xs text-slate-500">{c.englishName || c.contactEmail || c.serial || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    {c.isActive ? <Badge tone="green" dot>مفعّلة</Badge> : <Badge tone="red" dot>موقوفة</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={LICENSE_STATE_TONE[c.license.state]}>{LICENSE_STATE_LABEL[c.license.state]}</Badge>
                    {c.license.subscription?.expiryDate && (
                      <p className="mt-1 text-[11px] text-slate-500">حتى {fmtDate(c.license.subscription.expiryDate)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <span className="font-bold text-[#0A3D5E]">{c.users.total}</span> مستخدم
                    {c.license.subscription && <span className="text-slate-400"> / {c.license.subscription.maxUsers}</span>}
                    <p className="text-[11px] text-slate-500">{c.users.activeLast7Days} نشط هذا الأسبوع</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#0A3D5E]">{fmtMinutes(c.activeMinutesLast7Days)}</td>
                  <td className="px-4 py-3 text-xs">
                    {isOnline(c.lastSeenAt) ? <Badge tone="green" dot>متصل الآن</Badge> : <span className="text-slate-500">{fmtRelative(c.lastSeenAt)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.ai.enabled ? (
                      <span className="flex items-center gap-1 text-xs text-slate-600"><Sparkles className="h-3.5 w-3.5 text-brand" />{Math.round((c.ai.used / Math.max(1, c.ai.limit)) * 100)}%</span>
                    ) : (
                      <Badge tone="red">موقوف</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
            </Table>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </Card>

      {creating && <CreateCompanyDialog open onClose={() => setCreating(false)} />}
    </>
  );
}
