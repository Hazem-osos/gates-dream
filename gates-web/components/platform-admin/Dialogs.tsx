'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminRequest, type CompanyRow } from '@/lib/platform-admin/api';
import { useAdminMutation, useCan, useCompanies } from '@/lib/platform-admin/hooks';
import { Button, Field, Input, Modal, Select, Toggle } from './ui';
import { defaultLicenseDraft, LicenseForm, licenseDraftError, licenseDraftToPayload } from './LicenseForm';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

interface NewUserDraft {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

const emptyUser: NewUserDraft = { email: '', username: '', password: '', firstName: '', lastName: '' };

function userDraftError(u: NewUserDraft): string | null {
  if (!emailOk(u.email)) return 'بريد إلكتروني غير صالح';
  if (u.username.trim().length < 3) return 'اسم المستخدم 3 أحرف على الأقل';
  if (u.password.length < 8) return 'كلمة المرور 8 أحرف على الأقل';
  return null;
}

function UserFields({ value, onChange }: { value: NewUserDraft; onChange: (v: NewUserDraft) => void }) {
  const set = (k: keyof NewUserDraft, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="الاسم الأول"><Input value={value.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
      <Field label="اسم العائلة"><Input value={value.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
      <Field label="البريد الإلكتروني *">
        <Input type="email" dir="ltr" className="text-left" value={value.email} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field label="اسم المستخدم *">
        <Input dir="ltr" className="text-left" value={value.username} onChange={(e) => set('username', e.target.value)} />
      </Field>
      <Field label="كلمة المرور *" hint="8 أحرف على الأقل">
        <Input type="text" dir="ltr" className="text-left" autoComplete="new-password" value={value.password} onChange={(e) => set('password', e.target.value)} />
      </Field>
    </div>
  );
}

export function CreateCompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [arabicName, setArabicName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone1, setPhone1] = useState('');
  const [admin, setAdmin] = useState<NewUserDraft>(emptyUser);
  const canLicense = useCan()('licenses.edit');
  const [withLicense, setWithLicense] = useState(canLicense);
  const [license, setLicense] = useState(defaultLicenseDraft());
  const [error, setError] = useState('');

  const create = useAdminMutation(
    (body: unknown) => adminRequest<{ company: { id: string } }>('/companies', { method: 'POST', body }),
    {
      success: 'تم إنشاء الشركة ومديرها',
      onSuccess: (r) => {
        onClose();
        router.push(`/admin/companies/${r.company.id}`);
      },
    }
  );

  const submit = () => {
    setError('');
    if (!arabicName.trim()) return setError('اكتب اسم الشركة');
    if (contactEmail && !emailOk(contactEmail)) return setError('بريد التواصل غير صالح');
    const ue = userDraftError(admin);
    if (ue) return setError(`مدير الشركة: ${ue}`);
    if (withLicense) {
      const le = licenseDraftError(license);
      if (le) return setError(`الترخيص: ${le}`);
    }
    create.mutate({
      arabicName: arabicName.trim(),
      englishName: englishName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      phone1: phone1.trim() || undefined,
      admin: {
        email: admin.email.trim(),
        username: admin.username.trim(),
        password: admin.password,
        firstName: admin.firstName.trim() || undefined,
        lastName: admin.lastName.trim() || undefined,
      },
      license: withLicense ? licenseDraftToPayload(license) : undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="شركة جديدة"
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={create.isPending}>إنشاء الشركة</Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <h4 className="mb-3 text-sm font-bold text-[#0A3D5E]">بيانات الشركة</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم بالعربي *"><Input value={arabicName} onChange={(e) => setArabicName(e.target.value)} /></Field>
            <Field label="الاسم بالإنجليزي"><Input dir="ltr" className="text-left" value={englishName} onChange={(e) => setEnglishName(e.target.value)} /></Field>
            <Field label="بريد التواصل"><Input type="email" dir="ltr" className="text-left" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
            <Field label="الهاتف"><Input dir="ltr" className="text-left" value={phone1} onChange={(e) => setPhone1(e.target.value)} /></Field>
          </div>
        </section>
        <section>
          <h4 className="mb-1 text-sm font-bold text-[#0A3D5E]">مدير الشركة</h4>
          <p className="mb-3 text-xs text-slate-500">أول مستخدم للشركة بصلاحيات كاملة داخلها.</p>
          <UserFields value={admin} onChange={setAdmin} />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#0A3D5E]">الترخيص</h4>
            {canLicense && (
              <span className="flex items-center gap-2 text-xs text-slate-600">
                إصدار ترخيص الآن <Toggle checked={withLicense} onChange={setWithLicense} label="إصدار ترخيص" />
              </span>
            )}
          </div>
          {withLicense ? (
            <LicenseForm value={license} onChange={setLicense} />
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              بدون ترخيص تعمل الشركة بلا قيود. يمكنك إصدار الترخيص لاحقاً من صفحة الشركة.
            </p>
          )}
        </section>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}

export function CreateUserDialog({
  open,
  onClose,
  companyId: fixedCompanyId,
}: {
  open: boolean;
  onClose: () => void;
  companyId?: string;
}) {
  const [companySearch, setCompanySearch] = useState('');
  const [companyId, setCompanyId] = useState(fixedCompanyId ?? '');
  const [user, setUser] = useState<NewUserDraft>(emptyUser);
  const [phone, setPhone] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const companies = useCompanies({ page: 1, pageSize: 50, search: companySearch || undefined });

  const create = useAdminMutation((body: unknown) => adminRequest('/users', { method: 'POST', body }), {
    success: 'تم إنشاء المستخدم',
    onSuccess: () => {
      setUser(emptyUser);
      setPhone('');
      setIsAdmin(false);
      onClose();
    },
  });

  const submit = () => {
    setError('');
    const cid = fixedCompanyId ?? companyId;
    if (!cid) return setError('اختر الشركة');
    const ue = userDraftError(user);
    if (ue) return setError(ue);
    create.mutate({
      companyId: cid,
      email: user.email.trim(),
      username: user.username.trim(),
      password: user.password,
      firstName: user.firstName.trim() || undefined,
      lastName: user.lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      isAdmin,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="مستخدم جديد"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={create.isPending}>إنشاء المستخدم</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedCompanyId && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="بحث عن شركة">
              <Input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="اكتب جزءاً من الاسم" />
            </Field>
            <Field label="الشركة *">
              <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">— اختر —</option>
                {(companies.data?.rows ?? []).map((c: CompanyRow) => (
                  <option key={c.id} value={c.id}>{c.arabicName}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <UserFields value={user} onChange={setUser} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الهاتف"><Input dir="ltr" className="text-left" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <div className="flex items-end">
            <span className="flex h-10 items-center gap-3 text-sm text-[#0A3D5E]">
              <Toggle checked={isAdmin} onChange={setIsAdmin} label="مدير الشركة" />
              مدير الشركة (كل الصلاحيات)
            </span>
          </div>
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}
