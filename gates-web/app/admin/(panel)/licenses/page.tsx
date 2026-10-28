'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PauseCircle, PlayCircle, Search, Pencil } from 'lucide-react';
import { adminRequest } from '@/lib/platform-admin/api';
import { useAdminMutation, useCompanies } from '@/lib/platform-admin/hooks';
import { daysUntil, fmtDate, LICENSE_STATE_LABEL, LICENSE_STATE_TONE, MODULE_LABEL, PLAN_LABEL } from '@/lib/platform-admin/format';
import { Badge, Button, Card, EmptyState, ErrorBox, Input, PageHeader, Pager, Spinner, Table, Tabs } from '@/components/platform-admin/ui';

type Filter = 'all' | 'active' | 'trial' | 'expiring' | 'expired' | 'suspended' | 'unlicensed';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'مفعّل' },
  { value: 'trial', label: 'تجريبي' },
  { value: 'expiring', label: 'ينتهي قريباً' },
  { value: 'expired', label: 'منتهي' },
  { value: 'suspended', label: 'موقوف' },
  { value: 'unlicensed', label: 'بدون ترخيص' },
];

function LicensesView() {
  const params = useSearchParams();
  const initial = (FILTERS.find((f) => f.value === params.get('filter'))?.value ?? 'all') as Filter;
  const [filter, setFilter] = useState<Filter>(initial);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCompanies({ page, pageSize: 20, license: filter, search: search || undefined });
  const setStatus = useAdminMutation(
    ({ id, status }: { id: string; status: string }) =>
      adminRequest(`/companies/${id}/license/status`, { method: 'PATCH', body: { status } }),
    { success: 'تم تحديث حالة الترخيص' }
  );

  return (
    <>
      <PageHeader title="التراخيص" subtitle="مدة كل ترخيص، الموديولات، الحدود، والإيقاف أو إعادة التفعيل بضغطة" />
      <Tabs<Filter> value={filter} onChange={(v) => { setFilter(v); setPage(1); }} items={FILTERS} />
      <Card>
        <div className="relative mb-4 max-w-md">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pr-9" placeholder="بحث عن شركة" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox error={error} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState title="لا توجد شركات في هذا التصنيف" />
        ) : (
          <>
            <Table head={['الشركة', 'الحالة', 'النوع', 'الفترة', 'المتبقي', 'الحدود', 'الموديولات', 'إجراءات']}>
              {data.rows.map((c) => {
                const sub = c.license.subscription;
                const left = daysUntil(sub?.expiryDate);
                return (
                  <tr key={c.id} className="hover:bg-[#F8FCFE]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/companies/${c.id}`} className="font-bold text-[#0A3D5E] hover:text-brand">{c.arabicName}</Link>
                    </td>
                    <td className="px-4 py-3"><Badge tone={LICENSE_STATE_TONE[c.license.state]} dot>{LICENSE_STATE_LABEL[c.license.state]}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{sub ? PLAN_LABEL[sub.planType] : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {sub ? <>{fmtDate(sub.startDate)} ← {sub.planType === 'LIFETIME' ? 'دائم' : fmtDate(sub.expiryDate)}</> : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {sub?.planType === 'SUBSCRIPTION' && left !== null ? (
                        <span className={left < 0 ? 'font-semibold text-red-600' : left <= 30 ? 'font-semibold text-amber-700' : 'text-slate-600'}>
                          {left < 0 ? `انتهى منذ ${-left} يوم` : `${left} يوم`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {sub ? <>{c.users.total}/{sub.maxUsers} مستخدم · {c.branches}/{sub.maxBranches} فرع</> : `${c.users.total} مستخدم`}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-[11px] text-slate-500">
                      {sub ? sub.allowedModules.map((m) => MODULE_LABEL[m] ?? m).join('، ') : 'الكل'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/admin/companies/${c.id}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-[#EEF6FA] hover:text-[#0A3D5E]" title="تعديل">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        {sub && (sub.status === 'SUSPENDED' || sub.status === 'EXPIRED' ? (
                          <Button size="sm" variant="success" icon={<PlayCircle className="h-3.5 w-3.5" />} loading={setStatus.isPending && setStatus.variables?.id === c.id} onClick={() => setStatus.mutate({ id: c.id, status: 'ACTIVE' })}>تفعيل</Button>
                        ) : (
                          <Button size="sm" variant="secondary" icon={<PauseCircle className="h-3.5 w-3.5 text-red-600" />} loading={setStatus.isPending && setStatus.variables?.id === c.id} onClick={() => setStatus.mutate({ id: c.id, status: 'SUSPENDED' })}>إيقاف</Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

export default function PlatformLicensesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LicensesView />
    </Suspense>
  );
}
