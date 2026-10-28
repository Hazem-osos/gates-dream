'use client';

import { useEffect, useState } from 'react';
import { Plus, Wrench, UserCog, KeyRound } from 'lucide-react';
import { adminRequest, getStoredAdminProfile } from '@/lib/platform-admin/api';
import { useAdminMutation, useAdmins, useSettings } from '@/lib/platform-admin/hooks';
import { fmtDate, fmtRelative } from '@/lib/platform-admin/format';
import { Badge, Button, Card, ConfirmDialog, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Table, Toggle } from '@/components/platform-admin/ui';

export default function PlatformSettingsPage() {
  return (
    <>
      <PageHeader title="إعدادات المنصة" subtitle="وضع الصيانة، مديرو المنصة، وكلمة مرورك" />
      <div className="space-y-6">
        <MaintenanceCard />
        <AdminsCard />
        <PasswordCard />
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
          <Input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
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

function AdminsCard() {
  const { data, isLoading, error } = useAdmins();
  const me = getStoredAdminProfile();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '' });
  const create = useAdminMutation(
    () => adminRequest('/admins', { method: 'POST', body: { email: form.email.trim(), name: form.name.trim() || undefined, password: form.password } }),
    {
      success: 'تمت إضافة مدير المنصة',
      onSuccess: () => {
        setOpen(false);
        setForm({ email: '', name: '', password: '' });
      },
    }
  );
  const toggle = useAdminMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) => adminRequest(`/admins/${id}`, { method: 'PATCH', body: { isActive } }),
    { success: 'تم التحديث' }
  );

  return (
    <Card
      title={<span className="flex items-center gap-2"><UserCog className="h-4 w-4" /> مديرو المنصة</span>}
      subtitle="من يستطيع الدخول إلى هذه اللوحة"
      actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>إضافة مدير</Button>}
    >
      {isLoading ? <Spinner /> : error || !data ? <ErrorBox error={error} /> : (
        <Table head={['الاسم', 'البريد', 'الحالة', 'آخر دخول', 'أُضيف في', 'مفعّل']}>
          {data.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-3 font-semibold text-[#0A3D5E]">{a.name || '—'} {a.id === me?.id && <Badge tone="brand">أنت</Badge>}</td>
              <td className="px-4 py-3 text-xs" dir="ltr">{a.email}</td>
              <td className="px-4 py-3">{a.isActive ? <Badge tone="green" dot>مفعّل</Badge> : <Badge tone="red" dot>موقوف</Badge>}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{fmtRelative(a.lastLoginAt)}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(a.createdAt)}</td>
              <td className="px-4 py-3">
                <Toggle
                  checked={a.isActive}
                  disabled={a.id === me?.id || toggle.isPending}
                  onChange={(isActive) => toggle.mutate({ id: a.id, isActive })}
                  label="تفعيل المدير"
                />
              </td>
            </tr>
          ))}
        </Table>
      )}
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
          <Field label="الاسم"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="البريد الإلكتروني"><Input type="email" dir="ltr" className="text-left" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="كلمة المرور" hint="8 أحرف على الأقل">
            <Input type="text" dir="ltr" className="text-left" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <p className="text-xs text-amber-700">مدير المنصة يتحكم في كل الشركات والمستخدمين والتراخيص.</p>
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
    () => adminRequest('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } }),
    {
      success: 'تم تغيير كلمة المرور',
      onSuccess: () => {
        setCurrent('');
        setNext('');
        setConfirm('');
      },
    }
  );
  const mismatch = confirm.length > 0 && confirm !== next;
  return (
    <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> كلمة مرور حسابك</span>}>
      <div className="grid gap-4 md:grid-cols-4 md:items-end">
        <Field label="الحالية"><Input type="password" dir="ltr" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="الجديدة" hint="8 أحرف على الأقل"><Input type="password" dir="ltr" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="تأكيد الجديدة" error={mismatch ? 'غير مطابقة' : undefined}><Input type="password" dir="ltr" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <Button loading={change.isPending} disabled={!current || next.length < 8 || next !== confirm} onClick={() => change.mutate(undefined)}>تغيير كلمة المرور</Button>
      </div>
    </Card>
  );
}
