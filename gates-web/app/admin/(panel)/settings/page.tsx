'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Plus, Wrench, UserCog, KeyRound, ShieldCheck, ShieldOff, Smartphone, RotateCcw } from 'lucide-react';
import { adminRequest, replaceAdminToken, type AdminRole, type TokenResult } from '@/lib/platform-admin/api';
import { useAdminMutation, useAdmins, useCan, useMe, useSettings } from '@/lib/platform-admin/hooks';
import { fmtDate, fmtRelative, ROLE_HINT, ROLE_LABEL } from '@/lib/platform-admin/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Toggle,
} from '@/components/platform-admin/ui';

const ROLES: AdminRole[] = ['OWNER', 'SUPPORT', 'FINANCE', 'SALES', 'VIEWER'];

export default function PlatformSettingsPage() {
  const can = useCan();
  return (
    <>
      <PageHeader title="إعدادات المنصة" subtitle="وضع الصيانة، حسابك وأمانه، وفريق الإدارة وأدواره" />
      <div className="space-y-6">
        {can('settings.edit') && <MaintenanceCard />}
        <div className="grid gap-6 xl:grid-cols-2">
          <TwoFactorCard />
          <PasswordCard />
        </div>
        {can('admins.manage') && <AdminsCard />}
      </div>
    </>
  );
}

function MaintenanceCard() {
  const { data, isLoading, error } = useSettings();
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<null | boolean>(null);
  useEffect(() => {
    if (data) setMessage(data.maintenance.message);
  }, [data]);
  const save = useAdminMutation(
    (enabled: boolean) => adminRequest('/settings', { method: 'PATCH', body: { maintenance: { enabled, message } } }),
    { success: 'تم حفظ وضع الصيانة' }
  );
  if (isLoading) return <Card title="وضع الصيانة"><Spinner /></Card>;
  if (error || !data) return <ErrorBox error={error} />;
  const on = data.maintenance.enabled;
  return (
    <Card
      title={<span className="flex items-center gap-2"><Wrench className="h-4 w-4" /> وضع الصيانة</span>}
      subtitle="عند التفعيل يُمنع كل العملاء من الدخول واستخدام النظام، وتظهر لهم الرسالة التالية. لوحة الإدارة تبقى متاحة."
      actions={on ? <Badge tone="red" dot>مفعّل الآن</Badge> : <Badge tone="green" dot>النظام متاح</Badge>}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="الرسالة التي تظهر للعملاء">
          <Input id="maint-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex gap-2">
          {on && <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate(true)}>تحديث الرسالة</Button>}
          <Button variant={on ? 'success' : 'danger'} onClick={() => setConfirm(!on)}>
            {on ? 'إنهاء الصيانة' : 'تفعيل وضع الصيانة'}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        tone={confirm ? 'danger' : 'primary'}
        title={confirm ? 'تفعيل وضع الصيانة' : 'إنهاء وضع الصيانة'}
        confirmLabel={confirm ? 'تفعيل للجميع' : 'إنهاء الصيانة'}
        loading={save.isPending}
        message={confirm ? 'كل مستخدمي كل الشركات سيُمنعون من استخدام النظام خلال ثوانٍ حتى تنهي الصيانة.' : 'سيعود النظام متاحاً لكل العملاء.'}
        onConfirm={() => save.mutateAsync(Boolean(confirm)).then(() => setConfirm(null)).catch(() => undefined)}
      />
    </Card>
  );
}

function TwoFactorCard() {
  const { data: me } = useMe();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [disableOpen, setDisableOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const start = useAdminMutation(() => adminRequest<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' }), {
    onSuccess: async (r) => {
      const qr = await QRCode.toDataURL(r.otpauthUrl, { margin: 1, width: 220 }).catch(() => '');
      setSetup({ ...r, qr });
    },
  });
  const confirm = useAdminMutation(
    (c: string) => adminRequest<TokenResult>('/auth/2fa/confirm', { method: 'POST', body: { code: c } }),
    {
      success: 'تم تفعيل التحقق الثنائي',
      onSuccess: (t) => {
        replaceAdminToken(t.accessToken, t.expiresIn);
        setSetup(null);
        setCode('');
      },
    }
  );
  const disable = useAdminMutation(
    () => adminRequest<TokenResult>('/auth/2fa/disable', { method: 'POST', body: { password, code: disableCode } }),
    {
      success: 'تم إيقاف التحقق الثنائي',
      onSuccess: (t) => {
        replaceAdminToken(t.accessToken, t.expiresIn);
        setDisableOpen(false);
        setPassword('');
        setDisableCode('');
      },
    }
  );

  const enabled = Boolean(me?.twoFactorEnabled);
  return (
    <Card
      title={<span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> التحقق الثنائي</span>}
      subtitle="رمز من تطبيق على هاتفك (Google Authenticator أو Microsoft Authenticator) مع كلمة المرور عند كل دخول"
      actions={enabled ? <Badge tone="green" dot>مفعّل</Badge> : <Badge tone="amber" dot>غير مفعّل</Badge>}
    >
      {enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-slate-600"><ShieldCheck className="h-4 w-4 text-emerald-600" /> حسابك محمي برمز الهاتف.</p>
          <Button variant="secondary" icon={<ShieldOff className="h-4 w-4" />} onClick={() => setDisableOpen(true)}>إيقاف التحقق الثنائي</Button>
        </div>
      ) : setup ? (
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
          {setup.qr ? (
            <img src={setup.qr} alt="رمز QR لإضافة الحساب إلى تطبيق المصادقة" className="h-[180px] w-[180px] rounded-xl border border-[#E3EEF4] bg-white p-2" />
          ) : null}
          <div className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1 pr-5 text-slate-600">
              <li>افتح تطبيق المصادقة على هاتفك واختر إضافة حساب.</li>
              <li>امسح الرمز، أو اكتب المفتاح يدوياً.</li>
              <li>اكتب الرمز المكوّن من 6 أرقام الظاهر في التطبيق.</li>
            </ol>
            <p className="break-all rounded-lg bg-[#F1F8FB] px-3 py-2 font-mono text-xs text-[#0A3D5E]" dir="ltr">{setup.secret}</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="الرمز">
                <Input
                  id="totp-confirm"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  maxLength={6}
                  className="w-36 text-center tracking-[0.4em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <Button loading={confirm.isPending} disabled={code.length !== 6} onClick={() => confirm.mutate(code)}>تفعيل</Button>
              <Button variant="ghost" onClick={() => setSetup(null)}>إلغاء</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">ننصح بتفعيله لكل من يملك صلاحية إيقاف الشركات أو المستخدمين.</p>
          <Button icon={<ShieldCheck className="h-4 w-4" />} loading={start.isPending} onClick={() => start.mutate(undefined)}>إعداد التحقق الثنائي</Button>
        </div>
      )}
      <Modal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="إيقاف التحقق الثنائي"
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDisableOpen(false)}>إلغاء</Button>
            <Button variant="danger" loading={disable.isPending} disabled={!password || disableCode.length !== 6} onClick={() => disable.mutate(undefined)}>
              إيقاف
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="كلمة المرور">
            <Input id="2fa-off-pass" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="رمز التطبيق">
            <Input id="2fa-off-code" inputMode="numeric" dir="ltr" maxLength={6} value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const change = useAdminMutation(
    () => adminRequest<TokenResult>('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } }),
    {
      success: 'تم تغيير كلمة المرور وتسجيل الخروج من باقي الأجهزة',
      onSuccess: (t) => {
        replaceAdminToken(t.accessToken, t.expiresIn);
        setCurrent('');
        setNext('');
        setConfirm('');
      },
    }
  );
  const mismatch = confirm.length > 0 && confirm !== next;
  return (
    <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> كلمة مرور حسابك</span>} subtitle="تغييرها يسجّل خروجك من أي جهاز آخر">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="الحالية"><Input id="pw-current" type="password" dir="ltr" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="الجديدة" hint="8 أحرف على الأقل"><Input id="pw-new" type="password" dir="ltr" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="تأكيد الجديدة" error={mismatch ? 'غير مطابقة' : undefined}><Input id="pw-confirm" type="password" dir="ltr" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button loading={change.isPending} disabled={!current || next.length < 8 || next !== confirm} onClick={() => change.mutate(undefined)}>تغيير كلمة المرور</Button>
      </div>
    </Card>
  );
}

function AdminsCard() {
  const { data, isLoading, error } = useAdmins();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'VIEWER' as AdminRole });
  const [resetFor, setResetFor] = useState<{ id: string; email: string } | null>(null);
  const create = useAdminMutation(
    () =>
      adminRequest('/admins', {
        method: 'POST',
        body: { email: form.email.trim(), name: form.name.trim() || undefined, password: form.password, role: form.role },
      }),
    {
      success: 'تمت إضافة مدير المنصة',
      onSuccess: () => {
        setOpen(false);
        setForm({ email: '', name: '', password: '', role: 'VIEWER' });
      },
    }
  );
  const update = useAdminMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) => adminRequest(`/admins/${id}`, { method: 'PATCH', body }),
    { success: 'تم الحفظ', onSuccess: () => setResetFor(null) }
  );

  return (
    <Card
      title={<span className="flex items-center gap-2"><UserCog className="h-4 w-4" /> فريق الإدارة</span>}
      subtitle="من يدخل هذه اللوحة، ودوره. تغيير الدور أو الإيقاف يسجّل خروجه فوراً."
      actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>إضافة مدير</Button>}
    >
      {isLoading ? <Spinner /> : error || !data ? <ErrorBox error={error} /> : (
        <Table head={['الاسم', 'البريد', 'الدور', 'التحقق الثنائي', 'آخر دخول', 'أُضيف في', 'مفعّل']}>
          {data.map((a) => {
            const self = a.id === me?.id;
            return (
              <tr key={a.id}>
                <td className="px-4 py-3 font-semibold text-[#0A3D5E]">{a.name || '—'} {self && <Badge tone="brand">أنت</Badge>}</td>
                <td className="px-4 py-3 text-xs" dir="ltr">{a.email}</td>
                <td className="px-4 py-3">
                  <Select
                    aria-label={`دور ${a.email}`}
                    className="h-8 min-w-[130px] text-xs"
                    value={a.role}
                    disabled={self || update.isPending}
                    onChange={(e) => update.mutate({ id: a.id, body: { role: e.target.value } })}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  {a.twoFactorEnabled ? (
                    <span className="flex items-center gap-1.5">
                      <Badge tone="green">مفعّل</Badge>
                      {!self && (
                        <button type="button" title="إعادة ضبط (لو فقد هاتفه)" className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => setResetFor({ id: a.id, email: a.email })}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  ) : (
                    <Badge tone="amber">غير مفعّل</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{fmtRelative(a.lastLoginAt)}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(a.createdAt)}</td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={a.isActive}
                    disabled={self || update.isPending}
                    onChange={(isActive) => update.mutate({ id: a.id, body: { isActive } })}
                    label="تفعيل المدير"
                  />
                </td>
              </tr>
            );
          })}
        </Table>
      )}
      <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-5">
        {ROLES.map((r) => (
          <p key={r}><b className="text-[#0A3D5E]">{ROLE_LABEL[r]}:</b> {ROLE_HINT[r]}</p>
        ))}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة مدير منصة"
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button loading={create.isPending} disabled={!form.email.includes('@') || form.password.length < 8} onClick={() => create.mutate(undefined)}>إضافة</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="الاسم"><Input id="adm-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="البريد الإلكتروني"><Input id="adm-email" type="email" dir="ltr" className="text-left" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="كلمة المرور" hint="8 أحرف على الأقل">
            <Input id="adm-pass" type="text" dir="ltr" className="text-left" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="الدور" hint={ROLE_HINT[form.role]}>
            <Select id="adm-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(resetFor)}
        onClose={() => setResetFor(null)}
        title="إعادة ضبط التحقق الثنائي"
        confirmLabel="إعادة ضبط"
        loading={update.isPending}
        message={<>سيدخل <b dir="ltr">{resetFor?.email}</b> بكلمة المرور فقط حتى يعيد إعداد التحقق الثنائي. استخدمها فقط لو فقد هاتفه.</>}
        onConfirm={() => resetFor && update.mutate({ id: resetFor.id, body: { resetTwoFactor: true } })}
      />
    </Card>
  );
}
