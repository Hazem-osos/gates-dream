'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Sparkles, Power } from 'lucide-react';
import { adminRequest } from '@/lib/platform-admin/api';
import { useAdminMutation, useCan, useCompanies, useDashboard, useSettings } from '@/lib/platform-admin/hooks';
import { fmtNum } from '@/lib/platform-admin/format';
import { Badge, Card, ConfirmDialog, EmptyState, ErrorBox, Input, PageHeader, Pager, Spinner, Stat, Table, Toggle } from '@/components/platform-admin/ui';

export default function PlatformAiPage() {
  const settings = useSettings();
  const dashboard = useDashboard();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmGlobal, setConfirmGlobal] = useState<null | boolean>(null);
  const can = useCan();
  const companies = useCompanies({ page, pageSize: 20, search: search || undefined });

  const setGlobal = useAdminMutation(
    (aiEnabled: boolean) => adminRequest('/settings', { method: 'PATCH', body: { aiEnabled } }),
    { success: (r) => ((r as { aiEnabled: boolean }).aiEnabled ? 'تم تشغيل الذكاء الاصطناعي للمنصة' : 'تم إيقاف الذكاء الاصطناعي للمنصة') }
  );
  const setCompany = useAdminMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) => adminRequest(`/companies/${id}/ai`, { method: 'PATCH', body: { enabled } }),
    { success: 'تم التحديث' }
  );

  const globalOn = settings.data?.aiEnabled ?? true;

  return (
    <>
      <PageHeader title="الذكاء الاصطناعي" subtitle="تشغيل وإيقاف Gates Intelligence للمنصة كلها أو لشركة بعينها، ومتابعة الاستهلاك" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`rounded-2xl border p-5 lg:col-span-2 ${globalOn ? 'border-emerald-200 bg-gradient-to-l from-emerald-50 to-white' : 'border-red-200 bg-gradient-to-l from-red-50 to-white'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-lg font-black text-[#0A3D5E]">
                <Power className={`h-5 w-5 ${globalOn ? 'text-emerald-600' : 'text-red-600'}`} />
                {globalOn ? 'الذكاء الاصطناعي يعمل على المنصة' : 'الذكاء الاصطناعي متوقف على المنصة'}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">
                المفتاح الرئيسي: عند الإيقاف تتوقف كل المحادثات والتحليلات والتنبيهات الذكية لكل الشركات فوراً، بما فيها
                المهام التي تعمل في الخلفية. لا يتم حذف أي محادثات أو بيانات.
              </p>
            </div>
            {settings.isLoading ? <Spinner label="" /> : (
              <Toggle checked={globalOn} disabled={setGlobal.isPending || !can('settings.edit')} onChange={(v) => setConfirmGlobal(v)} label="المفتاح الرئيسي للذكاء الاصطناعي" />
            )}
          </div>
        </div>
        <Stat
          label="الاستهلاك هذا الشهر (كل الشركات)"
          value={fmtNum(dashboard.data?.ai.tokensUsedThisMonth)}
          hint={`${fmtNum(dashboard.data?.ai.companiesDisabled)} شركة موقوف عنها`}
          icon={<Sparkles className="h-5 w-5" />}
        />
      </div>

      <Card className="mt-6" title="حسب الشركة">
        <div className="relative mb-4 max-w-md">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pr-9" placeholder="بحث عن شركة" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {companies.isLoading ? (
          <Spinner />
        ) : companies.error ? (
          <ErrorBox error={companies.error} />
        ) : !companies.data || companies.data.rows.length === 0 ? (
          <EmptyState title="لا توجد شركات" />
        ) : (
          <>
            <Table head={['الشركة', 'الحالة', 'الاستهلاك', 'الحد الشهري', 'تشغيل']}>
              {companies.data.rows.map((c) => {
                const pct = Math.min(100, Math.round((c.ai.used / Math.max(1, c.ai.limit)) * 100));
                return (
                  <tr key={c.id} className="hover:bg-[#F8FCFE]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/companies/${c.id}`} className="font-bold text-[#0A3D5E] hover:text-brand">{c.arabicName}</Link>
                    </td>
                    <td className="px-4 py-3">
                      {!globalOn ? <Badge tone="amber">متوقف (المنصة)</Badge> : c.ai.enabled ? <Badge tone="green" dot>يعمل</Badge> : <Badge tone="red" dot>موقوف</Badge>}
                    </td>
                    <td className="w-64 px-4 py-3">
                      <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{fmtNum(c.ai.used)}</span><span>{pct}%</span></div>
                      <div className="h-1.5 rounded-full bg-[#EEF4F8]">
                        <div className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-[#0E78AA]'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmtNum(c.ai.limit)}</td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={c.ai.enabled}
                        disabled={setCompany.isPending || !can('ai.edit')}
                        onChange={(enabled) => setCompany.mutate({ id: c.id, enabled })}
                        label={`تشغيل الذكاء الاصطناعي لـ ${c.arabicName}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pager page={companies.data.page} pageSize={companies.data.pageSize} total={companies.data.total} onPage={setPage} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={confirmGlobal !== null}
        onClose={() => setConfirmGlobal(null)}
        tone={confirmGlobal ? 'primary' : 'danger'}
        title={confirmGlobal ? 'تشغيل الذكاء الاصطناعي للمنصة' : 'إيقاف الذكاء الاصطناعي للمنصة'}
        confirmLabel={confirmGlobal ? 'تشغيل' : 'إيقاف للجميع'}
        loading={setGlobal.isPending}
        message={
          confirmGlobal
            ? 'سيعود الذكاء الاصطناعي للعمل لكل الشركات المفعّل لها.'
            : 'سيتوقف الذكاء الاصطناعي لكل الشركات خلال ثوانٍ، بما في ذلك المهام الخلفية.'
        }
        onConfirm={() =>
          setGlobal.mutateAsync(Boolean(confirmGlobal)).then(() => setConfirmGlobal(null)).catch(() => undefined)
        }
      />
    </>
  );
}
