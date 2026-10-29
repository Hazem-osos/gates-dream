'use client';

import { useMemo, useState } from 'react';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { adminRequest, type AnnouncementLevel, type AnnouncementRow } from '@/lib/platform-admin/api';
import { useAdminMutation, useAnnouncements, useCompanies } from '@/lib/platform-admin/hooks';
import { fmtDateTime } from '@/lib/platform-admin/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Toggle,
  cx,
} from '@/components/platform-admin/ui';

const LEVEL_LABEL: Record<AnnouncementLevel, string> = { info: 'معلومة', warning: 'تنبيه', critical: 'هام جداً' };
const LEVEL_TONE: Record<AnnouncementLevel, 'blue' | 'amber' | 'red'> = { info: 'blue', warning: 'amber', critical: 'red' };

function toLocalInput(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function liveState(a: AnnouncementRow): { label: string; tone: 'green' | 'gray' | 'amber' } {
  const now = Date.now();
  if (!a.isActive) return { label: 'موقوف', tone: 'gray' };
  if (new Date(a.startsAt).getTime() > now) return { label: 'مجدول', tone: 'amber' };
  if (a.endsAt && new Date(a.endsAt).getTime() <= now) return { label: 'انتهى', tone: 'gray' };
  return { label: 'ظاهر الآن', tone: 'green' };
}

interface Draft {
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: 'ALL' | 'COMPANIES';
  companyIds: string[];
  startsAt: string;
  endsAt: string;
}

const emptyDraft = (): Draft => ({
  title: '',
  body: '',
  level: 'info',
  audience: 'ALL',
  companyIds: [],
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: '',
});

function AnnouncementDialog({ initial, onClose }: { initial: AnnouncementRow | null; onClose: () => void }) {
  const [d, setD] = useState<Draft>(() =>
    initial
      ? {
          title: initial.title,
          body: initial.body,
          level: initial.level,
          audience: initial.audience,
          companyIds: initial.companyIds ?? [],
          startsAt: toLocalInput(initial.startsAt),
          endsAt: toLocalInput(initial.endsAt),
        }
      : emptyDraft()
  );
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const companies = useCompanies({ page: 1, pageSize: 50, search: search || undefined });
  const save = useAdminMutation(
    (body: unknown) =>
      initial
        ? adminRequest(`/announcements/${initial.id}`, { method: 'PUT', body })
        : adminRequest('/announcements', { method: 'POST', body }),
    { success: initial ? 'تم حفظ الإعلان' : 'تم نشر الإعلان', onSuccess: onClose }
  );
  const toggleCompany = (id: string) =>
    setD((x) => ({ ...x, companyIds: x.companyIds.includes(id) ? x.companyIds.filter((c) => c !== id) : [...x.companyIds, id] }));

  const submit = () => {
    setError('');
    if (!d.title.trim()) return setError('اكتب عنوان الإعلان');
    if (!d.body.trim()) return setError('اكتب نص الإعلان');
    if (d.audience === 'COMPANIES' && d.companyIds.length === 0) return setError('اختر شركة واحدة على الأقل');
    if (d.endsAt && d.startsAt && new Date(d.endsAt) <= new Date(d.startsAt)) return setError('وقت الانتهاء يجب أن يكون بعد البداية');
    save.mutate({
      title: d.title.trim(),
      body: d.body.trim(),
      level: d.level,
      audience: d.audience,
      companyIds: d.audience === 'COMPANIES' ? d.companyIds : undefined,
      startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : undefined,
      endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : null,
      ...(initial ? { isActive: initial.isActive } : {}),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'تعديل الإعلان' : 'إعلان جديد'}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={save.isPending}>{initial ? 'حفظ' : 'نشر'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="العنوان">
          <Input id="ann-title" value={d.title} maxLength={200} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="مثال: صيانة مجدولة يوم الجمعة" />
        </Field>
        <Field label="النص" hint={`${d.body.length} / 2000`}>
          <textarea
            id="ann-body"
            value={d.body}
            maxLength={2000}
            rows={4}
            onChange={(e) => setD({ ...d, body: e.target.value })}
            className="w-full rounded-xl border border-[#CFE7F2] bg-[#F8FCFE] px-3 py-2 text-sm text-[#0A3D5E] outline-none focus:border-[#0E78AA] focus:bg-white focus:ring-2 focus:ring-[#0E78AA]/20"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الأهمية">
            <Select id="ann-level" value={d.level} onChange={(e) => setD({ ...d, level: e.target.value as AnnouncementLevel })}>
              <option value="info">معلومة (أزرق)</option>
              <option value="warning">تنبيه (أصفر)</option>
              <option value="critical">هام جداً (أحمر)</option>
            </Select>
          </Field>
          <Field label="يظهر لـ">
            <Select id="ann-audience" value={d.audience} onChange={(e) => setD({ ...d, audience: e.target.value as Draft['audience'] })}>
              <option value="ALL">كل الشركات</option>
              <option value="COMPANIES">شركات محددة</option>
            </Select>
          </Field>
          <Field label="يبدأ الظهور">
            <Input id="ann-start" type="datetime-local" value={d.startsAt} onChange={(e) => setD({ ...d, startsAt: e.target.value })} />
          </Field>
          <Field label="يختفي في" hint="فارغ = يفضل ظاهر لحد ما توقفه">
            <Input id="ann-end" type="datetime-local" value={d.endsAt} onChange={(e) => setD({ ...d, endsAt: e.target.value })} />
          </Field>
        </div>
        {d.audience === 'COMPANIES' && (
          <div>
            <Field label={`الشركات المختارة (${d.companyIds.length})`}>
              <Input id="ann-company-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن شركة" />
            </Field>
            <div className="mt-2 grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {(companies.data?.rows ?? []).map((c) => {
                const on = d.companyIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCompany(c.id)}
                    className={cx(
                      'rounded-lg border px-3 py-1.5 text-right text-xs font-semibold transition',
                      on ? 'border-[#0E78AA] bg-[#0E78AA]/10 text-[#0A3D5E]' : 'border-[#E3EEF4] text-slate-500 hover:border-[#CFE7F2]'
                    )}
                  >
                    {on ? '✓ ' : ''}{c.arabicName}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[#0A3D5E]">معاينة</p>
          <AnnouncementPreview level={d.level} title={d.title || 'عنوان الإعلان'} body={d.body || 'نص الإعلان يظهر هنا لمستخدمي الشركات أعلى الشاشة.'} />
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}

function AnnouncementPreview({ level, title, body }: { level: AnnouncementLevel; title: string; body: string }) {
  const tone =
    level === 'critical'
      ? 'border-red-200 bg-red-50 text-red-800'
      : level === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-sky-200 bg-sky-50 text-sky-900';
  return (
    <div className={cx('flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm', tone)}>
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
      <p><b>{title}</b> — {body}</p>
    </div>
  );
}

export default function PlatformAnnouncementsPage() {
  const { data, isLoading, error } = useAnnouncements();
  const [editing, setEditing] = useState<AnnouncementRow | null | 'new'>(null);
  const [deleting, setDeleting] = useState<AnnouncementRow | null>(null);
  const toggle = useAdminMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) => adminRequest(`/announcements/${id}`, { method: 'PATCH', body: { isActive } }),
    { success: (r) => ((r as AnnouncementRow).isActive ? 'الإعلان ظاهر الآن' : 'تم إيقاف الإعلان') }
  );
  const remove = useAdminMutation((id: string) => adminRequest(`/announcements/${id}`, { method: 'DELETE' }), {
    success: 'تم حذف الإعلان',
    onSuccess: () => setDeleting(null),
  });
  const rows = useMemo(() => data ?? [], [data]);

  return (
    <>
      <PageHeader
        title="الإعلانات"
        subtitle="رسائل تظهر أعلى شاشة النظام لكل الشركات أو لشركات محددة: صيانة، ميزة جديدة، تذكير"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>إعلان جديد</Button>}
      />
      <Card>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox error={error} />
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد إعلانات" hint="أنشئ أول إعلان ليظهر لمستخدمي الشركات" />
        ) : (
          <ul className="divide-y divide-[#F0F5F8]">
            {rows.map((a) => {
              const st = liveState(a);
              return (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#0A3D5E]">{a.title}</h3>
                      <Badge tone={LEVEL_TONE[a.level]}>{LEVEL_LABEL[a.level]}</Badge>
                      <Badge tone={st.tone} dot>{st.label}</Badge>
                    </div>
                    <p className="text-sm leading-7 text-slate-600">{a.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {a.audience === 'ALL' ? 'كل الشركات' : `${a.companyIds?.length ?? 0} شركة محددة`} · من {fmtDateTime(a.startsAt)}
                      {a.endsAt ? ` إلى ${fmtDateTime(a.endsAt)}` : ''} · {a.createdBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={a.isActive}
                      disabled={toggle.isPending}
                      onChange={(isActive) => toggle.mutate({ id: a.id, isActive })}
                      label="تشغيل الإعلان"
                    />
                    <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-[#EEF6FA]" title="تعديل" onClick={() => setEditing(a)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="حذف" onClick={() => setDeleting(a)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {editing && <AnnouncementDialog initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="حذف الإعلان"
        confirmLabel="حذف"
        loading={remove.isPending}
        message={<>سيختفي «{deleting?.title}» من عند كل المستخدمين نهائياً.</>}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
