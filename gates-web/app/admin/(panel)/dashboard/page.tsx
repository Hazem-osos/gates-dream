'use client';

import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, Users, KeyRound, Sparkles, Activity, AlertTriangle, LogIn, CalendarClock } from 'lucide-react';
import { useDashboard } from '@/lib/platform-admin/hooks';
import { auditLabel, fmtDate, fmtDateTime, fmtMinutes, fmtNum } from '@/lib/platform-admin/format';
import { Badge, Card, EmptyState, ErrorBox, PageHeader, Spinner, Stat } from '@/components/platform-admin/ui';

export default function PlatformDashboardPage() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  const series = data.activitySeries.map((p) => ({ ...p, label: fmtDate(p.day) }));
  const needsAttention = data.licenses.expired + data.licenses.suspended + data.licenses.expiringIn30Days;

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle="نظرة شاملة على كل الشركات والمستخدمين والتراخيص" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="الشركات"
          value={fmtNum(data.companies.total)}
          hint={`${fmtNum(data.companies.active)} مفعّلة · ${fmtNum(data.companies.inactive)} موقوفة · ${fmtNum(data.companies.newLast30Days)} جديدة هذا الشهر`}
          icon={<Building2 className="h-5 w-5" />}
        />
        <Stat
          label="المستخدمون"
          value={fmtNum(data.users.total)}
          hint={`${fmtNum(data.users.active)} مفعّل · ${fmtNum(data.users.inactive)} موقوف`}
          icon={<Users className="h-5 w-5" />}
          tone="blue"
        />
        <Stat
          label="نشطون اليوم"
          value={fmtNum(data.users.activeToday)}
          hint={`${fmtNum(data.users.activeLast7Days)} خلال 7 أيام · ${fmtNum(data.users.loginsLast24h)} تسجيل دخول خلال 24 ساعة`}
          icon={<Activity className="h-5 w-5" />}
          tone="green"
        />
        <Stat
          label="استهلاك الذكاء الاصطناعي (الشهر)"
          value={fmtNum(data.ai.tokensUsedThisMonth)}
          hint={
            data.ai.platformEnabled
              ? `${fmtNum(data.ai.companiesDisabled)} شركة موقوف عنها الذكاء الاصطناعي`
              : 'متوقف على مستوى المنصة'
          }
          icon={<Sparkles className="h-5 w-5" />}
          tone={data.ai.platformEnabled ? 'brand' : 'red'}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="نشاط المستخدمين" subtitle="آخر 14 يوماً — عدد المستخدمين النشطين يومياً">
          {series.length === 0 ? (
            <EmptyState title="لا يوجد نشاط مسجّل بعد" hint="يبدأ التسجيل تلقائياً مع أول استخدام للنظام" />
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0E78AA" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0E78AA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF4F8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(v: number, name: string) => (name === 'activeUsers' ? [v, 'مستخدم نشط'] : [fmtMinutes(v), 'وقت الاستخدام'])}
                    labelStyle={{ fontWeight: 700 }}
                  />
                  <Area type="monotone" dataKey="activeUsers" stroke="#0E78AA" strokeWidth={2.5} fill="url(#adminArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card
          title="التراخيص"
          actions={<Link href="/admin/licenses" className="text-xs font-semibold text-brand hover:underline">إدارة التراخيص</Link>}
        >
          <ul className="space-y-3 text-sm">
            <Row icon={<KeyRound className="h-4 w-4 text-emerald-600" />} label="شركات لها ترخيص" value={data.licenses.licensed} />
            <Row icon={<KeyRound className="h-4 w-4 text-slate-400" />} label="بدون ترخيص (وصول مفتوح)" value={data.licenses.unlicensed} />
            <Row icon={<CalendarClock className="h-4 w-4 text-sky-600" />} label="تجريبي" value={data.licenses.trial} />
            <Row icon={<CalendarClock className="h-4 w-4 text-amber-600" />} label="ينتهي خلال 30 يوماً" value={data.licenses.expiringIn30Days} href="/admin/licenses?filter=expiring" />
            <Row icon={<AlertTriangle className="h-4 w-4 text-red-600" />} label="منتهي" value={data.licenses.expired} href="/admin/licenses?filter=expired" />
            <Row icon={<AlertTriangle className="h-4 w-4 text-red-600" />} label="موقوف" value={data.licenses.suspended} href="/admin/licenses?filter=suspended" />
          </ul>
          {needsAttention > 0 && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {fmtNum(needsAttention)} ترخيص يحتاج متابعة
            </p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="الأكثر استخداماً" subtitle="إجمالي وقت الاستخدام خلال 7 أيام">
          {data.topCompanies.length === 0 ? (
            <EmptyState title="لا توجد بيانات بعد" />
          ) : (
            <ul className="space-y-3">
              {data.topCompanies.map((c, i) => {
                const max = data.topCompanies[0]!.activeMinutes || 1;
                return (
                  <li key={c.companyId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <Link href={`/admin/companies/${c.companyId}`} className="font-semibold text-[#0A3D5E] hover:text-brand">
                        {i + 1}. {c.arabicName}
                      </Link>
                      <span className="text-xs text-slate-500">{fmtMinutes(c.activeMinutes)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#EEF4F8]">
                      <div className="h-2 rounded-full bg-gradient-to-l from-[#0E78AA] to-[#1787B8]" style={{ width: `${Math.max(4, (c.activeMinutes / max) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="آخر العمليات"
          actions={<Link href="/admin/audit" className="text-xs font-semibold text-brand hover:underline">السجل الكامل</Link>}
        >
          {data.recentAudit.length === 0 ? (
            <EmptyState title="لا توجد عمليات بعد" />
          ) : (
            <ul className="divide-y divide-[#F0F5F8]">
              {data.recentAudit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <LogIn className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold">{auditLabel(a.action)}</span>
                    {a.action === 'admin.login_failed' && <Badge tone="red">تنبيه</Badge>}
                  </span>
                  <span className="text-xs text-slate-500">{fmtDateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href?: string }) {
  const content = (
    <span className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-600">{icon}{label}</span>
      <span className="font-bold text-[#0A3D5E]">{fmtNum(value)}</span>
    </span>
  );
  return <li>{href ? <Link href={href} className="block rounded-lg hover:bg-[#F6FBFD]">{content}</Link> : content}</li>;
}
