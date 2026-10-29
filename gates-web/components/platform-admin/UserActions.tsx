'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LogOut, Power, Trash2, ShieldCheck, ShieldOff } from 'lucide-react';
import { adminRequest } from '@/lib/platform-admin/api';
import { useAdminMutation, useCan } from '@/lib/platform-admin/hooks';
import { Button, ConfirmDialog, Field, Input, Modal } from './ui';

interface MinimalUser {
  id: string;
  email: string;
  isActive: boolean;
  isAdmin: boolean;
}

type Dialog = null | 'toggle' | 'delete' | 'password' | 'logout' | 'admin';

function useUserActions(user: MinimalUser, afterDelete?: () => void) {
  const patch = useAdminMutation(
    (body: Record<string, unknown>) => adminRequest(`/users/${user.id}`, { method: 'PATCH', body }),
    { success: 'تم الحفظ' }
  );
  const remove = useAdminMutation(() => adminRequest(`/users/${user.id}`, { method: 'DELETE' }), {
    success: 'تم حذف المستخدم',
    onSuccess: () => afterDelete?.(),
  });
  const reset = useAdminMutation(
    (password: string) => adminRequest(`/users/${user.id}/reset-password`, { method: 'POST', body: { password } }),
    { success: 'تم تعيين كلمة المرور وتسجيل خروج المستخدم' }
  );
  const logout = useAdminMutation(
    () => adminRequest<{ revoked: number; sessionsTracked: boolean }>(`/users/${user.id}/logout`, { method: 'POST' }),
    {
      success: (r) =>
        r.sessionsTracked ? `تم إنهاء ${r.revoked} جلسة` : 'تم الطلب — تتبع الجلسات غير مفعّل على هذا الخادم (Redis)',
    }
  );
  return { patch, remove, reset, logout };
}

function ActionDialogs({ user, dialog, close, afterDelete }: { user: MinimalUser; dialog: Dialog; close: () => void; afterDelete?: () => void }) {
  const { patch, remove, reset, logout } = useUserActions(user, afterDelete);
  const [password, setPassword] = useState('');
  const run = (p: Promise<unknown>) => p.then(close).catch(() => undefined);

  return (
    <>
      <ConfirmDialog
        open={dialog === 'toggle'}
        onClose={close}
        tone={user.isActive ? 'danger' : 'primary'}
        title={user.isActive ? 'إيقاف المستخدم' : 'تفعيل المستخدم'}
        confirmLabel={user.isActive ? 'إيقاف' : 'تفعيل'}
        loading={patch.isPending}
        message={
          user.isActive
            ? <>سيتم منع <b dir="ltr">{user.email}</b> من الدخول فوراً وإنهاء جلساته المفتوحة. بياناته تبقى كما هي.</>
            : <>سيتمكن <b dir="ltr">{user.email}</b> من الدخول مرة أخرى.</>
        }
        onConfirm={() => run(patch.mutateAsync({ isActive: !user.isActive }))}
      />
      <ConfirmDialog
        open={dialog === 'admin'}
        onClose={close}
        tone="primary"
        title={user.isAdmin ? 'سحب صلاحيات المدير' : 'منح صلاحيات المدير'}
        confirmLabel="تأكيد"
        loading={patch.isPending}
        message={
          user.isAdmin
            ? 'سيفقد المستخدم الصلاحيات الكاملة داخل شركته، وتبقى صلاحياته التفصيلية الأخرى.'
            : 'سيحصل المستخدم على كل الصلاحيات داخل شركته (عرض، تعديل، حذف، اعتماد، ترحيل).'
        }
        onConfirm={() => run(patch.mutateAsync({ isAdmin: !user.isAdmin }))}
      />
      <ConfirmDialog
        open={dialog === 'logout'}
        onClose={close}
        tone="primary"
        title="تسجيل خروج من كل الأجهزة"
        confirmLabel="تسجيل خروج"
        loading={logout.isPending}
        message="سيتم إنهاء كل جلسات هذا المستخدم ويحتاج لتسجيل الدخول مرة أخرى."
        onConfirm={() => run(logout.mutateAsync(undefined))}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={close}
        title="حذف المستخدم نهائياً"
        confirmLabel="حذف نهائي"
        loading={remove.isPending}
        message={
          <>
            سيتم حذف <b dir="ltr">{user.email}</b> نهائياً ولا يمكن التراجع. إذا كان المستخدم مرتبطاً بمستندات أو قيود
            فسيرفض النظام الحذف — استخدم <b>الإيقاف</b> بدلاً منه.
          </>
        }
        onConfirm={() => run(remove.mutateAsync(undefined))}
      />
      <Modal
        open={dialog === 'password'}
        onClose={close}
        title="تعيين كلمة مرور جديدة"
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={close}>إلغاء</Button>
            <Button
              loading={reset.isPending}
              disabled={password.length < 8}
              onClick={() => run(reset.mutateAsync(password).then(() => setPassword('')))}
            >
              حفظ
            </Button>
          </>
        }
      >
        <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل. سيتم تسجيل خروج المستخدم من كل الأجهزة.">
          <Input type="text" dir="ltr" className="text-left" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}

/** Compact icon buttons for table rows. */
export function UserRowActions({ user }: { user: MinimalUser }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const can = useCan();
  const btn = 'rounded-lg p-1.5 text-slate-500 transition hover:bg-[#EEF6FA] hover:text-[#0A3D5E]';
  return (
    <div className="flex items-center gap-0.5">
      {can('users.edit') && (
        <button type="button" className={btn} title={user.isActive ? 'إيقاف' : 'تفعيل'} onClick={() => setDialog('toggle')}>
          <Power className={`h-4 w-4 ${user.isActive ? 'text-emerald-600' : 'text-red-500'}`} />
        </button>
      )}
      {can('users.credentials') && (
        <>
          <button type="button" className={btn} title="كلمة مرور جديدة" onClick={() => setDialog('password')}>
            <KeyRound className="h-4 w-4" />
          </button>
          <button type="button" className={btn} title="تسجيل خروج من كل الأجهزة" onClick={() => setDialog('logout')}>
            <LogOut className="h-4 w-4" />
          </button>
        </>
      )}
      {can('users.delete') && (
        <button type="button" className={`${btn} hover:text-red-600`} title="حذف" onClick={() => setDialog('delete')}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {dialog && <ActionDialogs user={user} dialog={dialog} close={() => setDialog(null)} />}
    </div>
  );
}

/** Full buttons for the user detail page. */
export function UserActionBar({ user }: { user: MinimalUser }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const can = useCan();
  return (
    <>
      {can('users.edit') && (
        <>
          <Button variant={user.isActive ? 'danger' : 'success'} icon={<Power className="h-4 w-4" />} onClick={() => setDialog('toggle')}>
            {user.isActive ? 'إيقاف المستخدم' : 'تفعيل المستخدم'}
          </Button>
          <Button
            variant="secondary"
            icon={user.isAdmin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            onClick={() => setDialog('admin')}
          >
            {user.isAdmin ? 'سحب صلاحيات المدير' : 'جعله مدير الشركة'}
          </Button>
        </>
      )}
      {can('users.credentials') && (
        <>
          <Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} onClick={() => setDialog('password')}>كلمة مرور جديدة</Button>
          <Button variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={() => setDialog('logout')}>خروج من كل الأجهزة</Button>
        </>
      )}
      {can('users.delete') && (
        <Button variant="ghost" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDialog('delete')}>حذف</Button>
      )}
      {dialog && (
        <ActionDialogs user={user} dialog={dialog} close={() => setDialog(null)} afterDelete={() => router.replace('/admin/users')} />
      )}
    </>
  );
}
