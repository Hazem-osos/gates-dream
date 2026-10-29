'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowRight,
  Building2,
  KeyRound,
  Sparkles,
  Users,
  ScrollText,
  Power,
  Plus,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import { adminRequest, type CompanyDetail } from '@/lib/platform-admin/api';
import { useAdminMutation, useCan, useCompany } from '@/lib/platform-admin/hooks';
import { CompanyInsightsTab } from '@/components/platform-admin/CompanyInsightsTab';
import { LoginEventsTable } from '@/components/platform-admin/LoginEventsTable';
import {
  daysUntil,
  fmtDate,
  fmtMinutes,
  fmtNum,
  LICENSE_STATE_LABEL,
  LICENSE_STATE_TONE,
  MODULE_LABEL,
  PLAN_LABEL,
} from '@/lib/platform-admin/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  PageHeader,
  Spinner,
  Stat,
  Tabs,
  Toggle,
} from '@/components/platform-admin/ui';
import { UsersTable } from '@/components/platform-admin/UsersTable';
import { CreateUserDialog } from '@/components/platform-admin/Dialogs';
import { defaultLicenseDraft, LicenseForm, licenseDraftError, licenseDraftToPayload } from '@/components/platform-admin/LicenseForm';
import { AuditTable } from '@/components/platform-admin/AuditTable';

type Tab = 'overview' | 'usage' | 'users' | 'logins' | 'license' | 'ai' | 'audit';

export default function PlatformCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useCompany(id);
  const can = useCan();
  const [tab, setTab] = useState<Tab>('overview');
  const [confirmToggle, setConfirmToggle] = useState(false);

  const toggleActive = useAdminMutation(
    (isActive: boolean) => adminRequest(`/companies/${id}`, { method: 'PATCH', body: { isActive } }),
    { success: 'تم تحديث حالة الشركة' }
  );

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  return (
    <>
      <Link href="/admin/companies" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand">
        <ArrowRight className="h-3.5 w-3.5" /> كل الشركات
      </Link>
      <PageHeader
        title={data.arabicName}
        subtitle={[data.englishName, data.contactEmail, data.phone1].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            {data.isActive ? <Badge tone="green" dot>الشركة مفعّلة</Badge> : <Badge tone="red" dot>الشركة موقوفة</Badge>}
            <Badge tone={LICENSE_STATE_TONE[data.license.state]}>الترخيص: {LICENSE_STATE_LABEL[data.license.state]}</Badge>
            {can('companies.disable') && (
              <Button
                variant={data.isActive ? 'danger' : 'success'}
                icon={<Power className="h-4 w-4" />}
                onClick={() => setConfirmToggle(true)}
              >
                {data.isActive ? 'إيقاف الشركة' : 'تفعيل الشركة'}
              </Button>
            )}
          </>
        }
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview' as Tab, label: 'نظرة عامة', icon: <Building2 className="h-4 w-4" /> },
          { value: 'usage' as Tab, label: 'الاستخدام والصحة', icon: <BarChart3 className="h-4 w-4" /> },
          { value: 'users' as Tab, label: `المستخدمون (${data.counts.users})`, icon: <Users className="h-4 w-4" /> },
          ...(can('security.view') ? [{ value: 'logins' as Tab, label: 'سجل الدخول', icon: <ShieldAlert className="h-4 w-4" /> }] : []),
          { value: 'license' as Tab, label: 'الترخيص', icon: <KeyRound className="h-4 w-4" /> },
          { value: 'ai' as Tab, label: 'الذكاء الاصطناعي', icon: <Sparkles className="h-4 w-4" /> },
          ...(can('audit.view') ? [{ value: 'audit' as Tab, label: 'سجل العمليات', icon: <ScrollText className="h-4 w-4" /> }] : []),
        ]}
      />

      {tab === 'overview' && <OverviewTab data={data} />}
      {tab === 'usage' && <CompanyInsightsTab companyId={id} />}
      {tab === 'logins' && (
        <Card title="محاولات دخول مستخدمي الشركة">
          <LoginEventsTable companyId={id} />
        </Card>
      )}
      {tab === 'users' && <UsersTab companyId={id} />}
      {tab === 'license' && <LicenseTab data={data} />}
      {tab === 'ai' && <AiTab data={data} />}
      {tab === 'audit' && (
        <Card title="كل ما تم على هذه الشركة من لوحة الإدارة">
          <AuditTable companyId={id} />
        </Card>
      )}

      <ConfirmDialog
        open={confirmToggle}
        onClose={() => setConfirmToggle(false)}
        tone={data.isActive ? 'danger' : 'primary'}
        title={data.isActive ? 'إيقاف الشركة' : 'تفعيل الشركة'}
        confirmLabel={data.isActive ? 'إيقاف الشركة' : 'تفعيل'}
        loading={toggleActive.isPending}
        message={
          data.isActive
            ? 'كل مستخدمي الشركة سيُمنعون من الدخول خلال ثوانٍ. لا يتم حذف أي بيانات ويمكن إعادة التفعيل في أي وقت.'
            : 'سيتمكن مستخدمو الشركة من الدخول مرة أخرى (بشرط أن يكون الترخيص سارياً).'
        }
        onConfirm={() =>
          toggleActive.mutateAsync(!data.isActive).then(() => setConfirmToggle(false)).catch(() => undefined)
        }
      />
    </>
  );
}

function OverviewTab({ data }: { data: CompanyDetail }) {
  const canEdit = useCan()('companies.edit');
  const [form, setForm] = useState({
    arabicName: data.arabicName,
    englishName: data.englishName ?? '',
    contactEmail: data.contactEmail ?? '',
    phone1: data.phone1 ?? '',
    address: data.address ?? '',
    taxNumber1: data.taxNumber1 ?? '',
  });
  useEffect(() => {
    setForm({
      arabicName: data.arabicName,
      englishName: data.englishName ?? '',
      contactEmail: data.contactEmail ?? '',
      phone1: data.phone1 ?? '',
      address: data.address ?? '',
      taxNumber1: data.taxNumber1 ?? '',
    });
  }, [data]);
  const save = useAdminMutation(
    () =>
      adminRequest(`/companies/${data.id}`, {
        method: 'PATCH',
        body: {
          arabicName: form.arabicName.trim(),
          englishName: form.englishName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          phone1: form.phone1.trim() || null,
          address: form.address.trim() || null,
          taxNumber1: form.taxNumber1.trim() || null,
        },
      }),
    { success: 'تم حفظ بيانات الشركة' }
  );
  const series = data.activity.map((p) => ({ ...p, label: fmtDate(p.day) }));
  const totalMinutes = data.activity.reduce((s, p) => s + p.activeMinutes, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="المستخدمون" value={fmtNum(data.counts.users)} hint={`${fmtNum(data.counts.branches)} فرع`} icon={<Users className="h-5 w-5" />} />
        <Stat label="وقت الاستخدام (30 يوماً)" value={fmtMinutes(totalMinutes)} hint={`${data.activity.length} يوم نشاط`} icon={<Sparkles className="h-5 w-5" />} tone="green" />
        <Stat label="الفواتير" value={fmtNum(data.counts.invoices)} hint={`${fmtNum(data.counts.journalEntries)} قيد يومية`} icon={<ScrollText className="h-5 w-5" />} tone="blue" />
        <Stat label="الأصناف والعملاء" value={fmtNum(data.counts.items)} hint={`${fmtNum(data.counts.customers)} عميل · ${fmtNum(data.counts.suppliers)} مورد`} icon={<Building2 className="h-5 w-5" />} tone="amber" />
      </div>

      <Card title="النشاط اليومي" subtitle="عدد المستخدمين النشطين يومياً — آخر 30 يوماً">
        {series.length === 0 ? (
          <EmptyState title="لا يوجد نشاط مسجّل بعد" />
        ) : (
          <div className="h-60" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF4F8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(v: number, n: string) => (n === 'activeUsers' ? [v, 'مستخدم نشط'] : [fmtMinutes(v), 'وقت الاستخدام'])} />
                <Bar dataKey="activeUsers" fill="#0E78AA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card
        title="بيانات الشركة"
        subtitle={`أُنشئت في ${fmtDate(data.createdAt)} · ${data.isOnboarded ? 'أكملت الإعداد الأولي' : 'لم تكمل الإعداد الأولي بعد'}`}
        actions={
          canEdit ? (
            <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!form.arabicName.trim()}>حفظ</Button>
          ) : undefined
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="الاسم بالعربي"><Input value={form.arabicName} onChange={(e) => setForm({ ...form, arabicName: e.target.value })} /></Field>
          <Field label="الاسم بالإنجليزي"><Input dir="ltr" className="text-left" value={form.englishName} onChange={(e) => setForm({ ...form, englishName: e.target.value })} /></Field>
          <Field label="بريد التواصل"><Input dir="ltr" className="text-left" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
          <Field label="الهاتف"><Input dir="ltr" className="text-left" value={form.phone1} onChange={(e) => setForm({ ...form, phone1: e.target.value })} /></Field>
          <Field label="الرقم الضريبي"><Input dir="ltr" className="text-left" value={form.taxNumber1} onChange={(e) => setForm({ ...form, taxNumber1: e.target.value })} /></Field>
          <Field label="العنوان"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>
      </Card>
    </div>
  );
}

function UsersTab({ companyId }: { companyId: string }) {
  const can = useCan();
  const [creating, setCreating] = useState(false);
  return (
    <Card
      title="مستخدمو الشركة"
      actions={can('users.edit') ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>مستخدم جديد</Button> : undefined}
    >
      <UsersTable companyId={companyId} showCompany={false} />
      {creating && <CreateUserDialog open companyId={companyId} onClose={() => setCreating(false)} />}
    </Card>
  );
}

function LicenseTab({ data }: { data: CompanyDetail }) {
  const canEdit = useCan()('licenses.edit');
  const [draft, setDraft] = useState(() => defaultLicenseDraft(data.license));
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<null | 'suspend' | 'remove'>(null);
  useEffect(() => setDraft(defaultLicenseDraft(data.license)), [data.license]);

  const save = useAdminMutation(
    (body: unknown) => adminRequest(`/companies/${data.id}/license`, { method: 'PUT', body }),
    { success: 'تم حفظ الترخيص' }
  );
  const setStatus = useAdminMutation(
    (status: string) => adminRequest(`/companies/${data.id}/license/status`, { method: 'PATCH', body: { status } }),
    { success: 'تم تحديث حالة الترخيص' }
  );
  const remove = useAdminMutation(() => adminRequest(`/companies/${data.id}/license`, { method: 'DELETE' }), {
    success: 'تمت إزالة الترخيص',
  });

  const sub = data.license.subscription;
  const left = daysUntil(sub?.expiryDate);

  const submit = () => {
    const e = licenseDraftError(draft);
    setError(e ?? '');
    if (!e) save.mutate(licenseDraftToPayload(draft));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card title="الترخيص الحالي" className="xl:col-span-1">
        {!sub ? (
          <div className="space-y-3 text-sm text-slate-600">
            <Badge tone="gray">بدون ترخيص</Badge>
            <p className="leading-7">هذه الشركة تعمل بلا قيود حالياً (كل الموديولات، بدون تاريخ انتهاء). أصدر ترخيصاً لتحديد المدة والموديولات.</p>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <Badge tone={LICENSE_STATE_TONE[data.license.state]} dot>{LICENSE_STATE_LABEL[data.license.state]}</Badge>
            <dl className="space-y-2">
              <Item k="النوع" v={PLAN_LABEL[sub.planType]} />
              <Item k="يبدأ" v={fmtDate(sub.startDate)} />
              <Item k="ينتهي" v={sub.planType === 'LIFETIME' ? 'لا ينتهي' : fmtDate(sub.expiryDate)} />
              {left !== null && sub.planType === 'SUBSCRIPTION' && (
                <Item k="المتبقي" v={left >= 0 ? `${left} يوم` : `انتهى منذ ${-left} يوم`} />
              )}
              <Item k="المستخدمون" v={`${data.counts.users} / ${sub.maxUsers}`} />
              <Item k="الفروع" v={`${data.counts.branches} / ${sub.maxBranches}`} />
            </dl>
            <div className="flex flex-wrap gap-1.5">
              {sub.allowedModules.map((m) => <Badge key={m} tone="brand">{MODULE_LABEL[m] ?? m}</Badge>)}
            </div>
            <div className={`flex flex-wrap gap-2 border-t border-[#EEF4F8] pt-4 ${canEdit ? '' : 'hidden'}`}>
              {sub.status === 'SUSPENDED' || sub.status === 'EXPIRED' ? (
                <Button size="sm" variant="success" icon={<PlayCircle className="h-4 w-4" />} loading={setStatus.isPending} onClick={() => setStatus.mutate('ACTIVE')}>
                  إعادة تفعيل
                </Button>
              ) : (
                <Button size="sm" variant="danger" icon={<PauseCircle className="h-4 w-4" />} onClick={() => setConfirm('suspend')}>
                  إيقاف الترخيص
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirm('remove')}>
                إزالة الترخيص
              </Button>
            </div>
          </div>
        )}
      </Card>

      {canEdit ? (
        <Card
          className="xl:col-span-2"
          title={sub ? 'تعديل الترخيص' : 'إصدار ترخيص'}
          subtitle="الشركة تُمنع من الدخول تلقائياً قبل تاريخ البداية وبعد تاريخ الانتهاء أو عند الإيقاف"
          actions={<Button onClick={submit} loading={save.isPending}>{sub ? 'حفظ التعديلات' : 'إصدار الترخيص'}</Button>}
        >
          <LicenseForm value={draft} onChange={setDraft} />
          {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </Card>
      ) : (
        <Card className="xl:col-span-2" title="تعديل الترخيص">
          <p className="text-sm text-slate-500">تعديل التراخيص متاح لمالك المنصة وفريق المالية فقط.</p>
        </Card>
      )}

      <ConfirmDialog
        open={confirm === 'suspend'}
        onClose={() => setConfirm(null)}
        title="إيقاف الترخيص"
        confirmLabel="إيقاف"
        loading={setStatus.isPending}
        message="كل مستخدمي الشركة سيُمنعون من الدخول حتى تعيد تفعيل الترخيص. البيانات لا تتأثر."
        onConfirm={() => setStatus.mutateAsync('SUSPENDED').then(() => setConfirm(null)).catch(() => undefined)}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        onClose={() => setConfirm(null)}
        tone="primary"
        title="إزالة الترخيص"
        confirmLabel="إزالة"
        loading={remove.isPending}
        message="إزالة الترخيص تعيد الشركة لوضع «بدون ترخيص»: تعمل بلا قيود على المدة أو الموديولات. لمنع الشركة من العمل استخدم «إيقاف الترخيص» بدلاً من ذلك."
        onConfirm={() => remove.mutateAsync(undefined).then(() => setConfirm(null)).catch(() => undefined)}
      />
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold text-[#0A3D5E]">{v}</dd>
    </div>
  );
}

function AiTab({ data }: { data: CompanyDetail }) {
  const canEdit = useCan()('ai.edit');
  const [limit, setLimit] = useState(String(data.ai.limit));
  useEffect(() => setLimit(String(data.ai.limit)), [data.ai.limit]);
  const update = useAdminMutation(
    (body: Record<string, unknown>) => adminRequest(`/companies/${data.id}/ai`, { method: 'PATCH', body }),
    { success: 'تم تحديث إعدادات الذكاء الاصطناعي' }
  );
  const pct = Math.min(100, Math.round((data.ai.used / Math.max(1, data.ai.limit)) * 100));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="تشغيل Gates Intelligence لهذه الشركة">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F6FBFD] p-4">
          <div>
            <p className="font-bold text-[#0A3D5E]">{data.ai.enabled ? 'يعمل' : 'متوقف'}</p>
            <p className="mt-1 text-xs text-slate-500">
              الإيقاف يمنع المحادثات والتحليلات والتنبيهات الذكية لهذه الشركة فوراً، بما فيها المهام الخلفية.
            </p>
          </div>
          <Toggle checked={data.ai.enabled} disabled={update.isPending || !canEdit} onChange={(v) => update.mutate({ enabled: v })} label="تشغيل الذكاء الاصطناعي" />
        </div>
      </Card>
      <Card title="الاستهلاك الشهري" subtitle={`بدأت الدورة الحالية في ${fmtDate(data.ai.windowStartedAt)} (كل 30 يوماً)`}>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-[#0A3D5E]">{fmtNum(data.ai.used)} / {fmtNum(data.ai.limit)} رمز</span>
          <span className="text-xs text-slate-500">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[#EEF4F8]">
          <div className={`h-2.5 rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-gradient-to-l from-[#0E78AA] to-[#1787B8]'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end ${canEdit ? '' : 'hidden'}`}>
          <Field label="الحد الشهري (رموز)">
            <Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
          <Button
            loading={update.isPending}
            disabled={!/^\d+$/.test(limit)}
            onClick={() => update.mutate({ monthlyTokenLimit: Number(limit) })}
          >
            حفظ الحد
          </Button>
          <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} loading={update.isPending} onClick={() => update.mutate({ resetUsage: true })}>
            تصفير الاستهلاك
          </Button>
        </div>
      </Card>
    </div>
  );
}
