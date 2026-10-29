'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Clock, CalendarDays, LogIn, Sparkles, Monitor } from 'lucide-react';
import { adminRequest } from '@/lib/platform-admin/api';
import { useAdminMutation, useCan, useUser } from '@/lib/platform-admin/hooks';
import { fmtDate, fmtDateTime, fmtMinutes, fmtRelative, isOnline } from '@/lib/platform-admin/format';
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, PageHeader, Spinner, Stat, Table } from '@/components/platform-admin/ui';
import { UserActionBar } from '@/components/platform-admin/UserActions';
import { AuditTable } from '@/components/platform-admin/AuditTable';
import { LoginEventsTable } from '@/components/platform-admin/LoginEventsTable';

export default function PlatformUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useUser(id);
  const can = useCan();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', username: '', phone: '' });

  useEffect(() => {
    if (data) {
      setForm({
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        email: data.email,
        username: data.username,
        phone: data.phone ?? '',
      });
    }
  }, [data]);

  const save = useAdminMutation(
    () =>
      adminRequest(`/users/${id}`, {
        method: 'PATCH',
        body: {
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          email: form.email.trim(),
          username: form.username.trim(),
          phone: form.phone.trim() || null,
        },
      }),
    { success: 'تم حفظ بيانات المستخدم' }
  );

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || data.username;
  const series = data.activity.days.map((d) => ({ label: fmtDate(d.day), minutes: d.activeMinutes }));

  return (
    <>
      <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand">
        <ArrowRight className="h-3.5 w-3.5" /> كل المستخدمين
      </Link>
      <PageHeader
        title={name}
        subtitle={`${data.email} · ${data.company.arabicName}`}
        actions={<UserActionBar user={data} />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {data.isActive ? <Badge tone="green" dot>مفعّل</Badge> : <Badge tone="red" dot>موقوف</Badge>}
        {data.isAdmin && <Badge tone="brand">مدير الشركة</Badge>}
        {isOnline(data.activity.lastSeenAt) && <Badge tone="green" dot>متصل الآن</Badge>}
        {!data.company.isActive && <Badge tone="red">الشركة موقوفة</Badge>}
        <Link href={`/admin/companies/${data.company.id}`} className="text-xs font-semibold text-brand hover:underline">
          فتح صفحة الشركة
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="وقت الاستخدام (30 يوماً)" value={fmtMinutes(data.activity.activeMinutesLast30)} icon={<Clock className="h-5 w-5" />} />
        <Stat
          label="أيام العمل (30 يوماً)"
          value={data.activity.activeDaysLast30}
          hint={`متوسط ${fmtMinutes(data.activity.averageMinutesPerActiveDay)} في اليوم`}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="green"
        />
        <Stat
          label="آخر دخول"
          value={<span className="text-lg">{data.lastLoginAt ? fmtRelative(data.lastLoginAt) : 'لم يسجل دخول'}</span>}
          hint={`${data.loginCount} مرة تسجيل دخول · آخر ظهور ${fmtRelative(data.activity.lastSeenAt)}`}
          icon={<LogIn className="h-5 w-5" />}
          tone="blue"
        />
        <Stat label="محادثات الذكاء الاصطناعي" value={data.aiConversations} hint={`${data.permissionCount} صلاحية`} icon={<Sparkles className="h-5 w-5" />} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="وقت الاستخدام اليومي" subtitle="عدد الدقائق التي استخدم فيها النظام فعلياً كل يوم">
          {series.length === 0 ? (
            <EmptyState title="لا يوجد نشاط مسجّل خلال آخر 30 يوماً" />
          ) : (
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF4F8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(v: number) => [fmtMinutes(v), 'وقت الاستخدام']} />
                  <Bar dataKey="minutes" fill="#1787B8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="الصلاحيات والفروع">
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">مجموعات المستخدم</p>
              <div className="flex flex-wrap gap-1.5">
                {data.groups.length ? data.groups.map((g) => <Badge key={g.id} tone="blue">{g.arabicName}</Badge>) : <span className="text-xs text-slate-400">لا يوجد</span>}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">الفروع المسموح بها</p>
              <div className="flex flex-wrap gap-1.5">
                {data.branches.length ? data.branches.map((b) => <Badge key={b.id}>{b.arabicName}</Badge>) : <span className="text-xs text-slate-400">كل الفروع</span>}
              </div>
            </div>
            <p className="text-xs text-slate-500">الصلاحيات التفصيلية تُدار من داخل حساب الشركة نفسها.</p>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card
          title="البيانات الأساسية"
          subtitle={`أُنشئ في ${fmtDate(data.createdAt)}`}
          actions={
            can('users.edit') ? <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>حفظ</Button> : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم الأول"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="اسم العائلة"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
            <Field label="البريد الإلكتروني"><Input dir="ltr" className="text-left" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="اسم المستخدم"><Input dir="ltr" className="text-left" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="الهاتف"><Input dir="ltr" className="text-left" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
        </Card>

        <Card title="الجلسات المفتوحة" subtitle={data.sessions.tracked ? 'الأجهزة المسجّل عليها الدخول حالياً' : 'تتبع الجلسات يحتاج Redis على الخادم'}>
          {data.sessions.items.length === 0 ? (
            <EmptyState title="لا توجد جلسات مفتوحة" />
          ) : (
            <ul className="divide-y divide-[#F0F5F8]">
              {data.sessions.items.map((s, i) => (
                <li key={i} className="flex items-start gap-3 py-3 text-xs">
                  <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#0A3D5E]" dir="ltr">{s.userAgent ?? 'جهاز غير معروف'}</p>
                    <p className="text-slate-500">
                      <span dir="ltr">{s.ipAddress ?? '—'}</span> · آخر نشاط {fmtDateTime(s.lastActivityAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data.activity.days.length > 0 && (
        <Card className="mt-6" title="سجل الأيام" subtitle="أول وآخر ظهور في كل يوم عمل">
          <Table head={['اليوم', 'أول ظهور', 'آخر ظهور', 'وقت الاستخدام', 'عدد العمليات']}>
            {[...data.activity.days].reverse().map((d) => (
              <tr key={d.day}>
                <td className="px-4 py-2.5 font-semibold text-[#0A3D5E]">{fmtDate(d.day)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(d.firstSeenAt)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(d.lastSeenAt)}</td>
                <td className="px-4 py-2.5 text-xs font-semibold">{fmtMinutes(d.activeMinutes)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{d.requestCount}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {can('security.view') && (
        <Card className="mt-6" title="سجل الدخول" subtitle="كل محاولة دخول لهذا الحساب، ناجحة أو فاشلة">
          <LoginEventsTable userId={id} showUser={false} />
        </Card>
      )}

      {can('audit.view') && (
        <Card className="mt-6" title="ما تم على هذا المستخدم من لوحة الإدارة">
          <AuditTable targetId={id} />
        </Card>
      )}
    </>
  );
}
