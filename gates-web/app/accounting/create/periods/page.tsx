'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Lock, Unlock } from 'lucide-react';
import { FormSectionCard, CompactFormField } from '@/components/ui';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { PeriodsListSection, type PeriodRow } from '@/components/accounting/PeriodsListSection';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type FormState = {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(value: string, days: number): string {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toApiDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

const emptyForm = (startDate = todayIso()): FormState => ({
  code: '',
  name: '',
  startDate,
  endDate: startDate,
  isClosed: false,
});

export default function AccountingPeriodsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const { data: periodsRes } = useApiQuery<PeriodRow[]>(
    ['periods', { page: 1, pageSize: 200 }],
    '/accounting/periods',
    { page: 1, limit: 200 },
    { staleTime: 15_000 }
  );

  const periods = useMemo(() => periodsRes?.data ?? [], [periodsRes?.data]);
  const nextStartDate =
    (periodsRes as { nextStartDate?: string | null } | undefined)?.nextStartDate ||
    (periods.length
      ? addDaysIso(
          [...periods].sort((a, b) => toInputDate(b.endDate).localeCompare(toInputDate(a.endDate)))[0]
            .endDate,
          1
        )
      : todayIso());
  const otherCount = periods.filter((row) => row.id !== selectedId).length;
  const startDateLocked = otherCount > 0;

  useEffect(() => {
    if (selectedId || periodsRes == null) return;
    setForm((prev) =>
      prev.startDate === nextStartDate ? prev : { ...prev, startDate: nextStartDate, endDate: prev.endDate || nextStartDate }
    );
  }, [nextStartDate, periodsRes, selectedId]);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));

  const resetNew = (start = nextStartDate) => {
    setSelectedId(null);
    setForm(emptyForm(start));
    setError('');
  };

  const hydrate = (row: PeriodRow) => {
    setSelectedId(row.id);
    setForm({
      code: row.code ?? '',
      name: row.name ?? '',
      startDate: toInputDate(row.startDate) || todayIso(),
      endDate: toInputDate(row.endDate) || todayIso(),
      isClosed: Boolean(row.isClosed),
    });
    setError('');
    setSuccess('');
    setShowGuide(false);
  };

  const handleNew = () => {
    resetNew(nextStartDate);
    setSuccess('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.name.trim()) {
      setError('يرجى إدخال اسم الفترة');
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError('يرجى تحديد تاريخي البداية والنهاية');
      return;
    }
    const startDate = selectedId ? form.startDate : startDateLocked ? nextStartDate : form.startDate;
    if (startDate >= form.endDate) {
      setError('تاريخ البداية يجب أن يسبق تاريخ النهاية');
      return;
    }

    const body = {
      code: form.code.trim() || form.name.trim(),
      name: form.name.trim(),
      startDate: toApiDate(startDate),
      endDate: toApiDate(form.endDate),
    };

    setSaving(true);
    try {
      if (selectedId) {
        await apiClient.put<PeriodRow>(`/accounting/periods/${selectedId}`, body);
        setSuccess('تم تحديث الفترة المحاسبية');
      } else {
        await apiClient.post<PeriodRow>('/accounting/periods', body);
        setSuccess('تم حفظ الفترة المحاسبية');
      }
      invalidateQuery(['periods']);
      resetNew(addDaysIso(form.endDate, 1));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('حذف الفترة المحاسبية الحالية؟')) return;
    setError('');
    try {
      await apiClient.delete(`/accounting/periods/${selectedId}`);
      setSuccess('تم حذف الفترة');
      invalidateQuery(['periods']);
      resetNew(nextStartDate);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  const handleClose = async () => {
    if (!selectedId) return;
    setError('');
    setClosing(true);
    try {
      const res = await apiClient.post<PeriodRow>(`/accounting/periods/${selectedId}/close`);
      if (res.data) hydrate(res.data);
      setSuccess('تم إغلاق الفترة وترحيل قيد الإقفال');
      invalidateQuery(['periods']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إغلاق الفترة');
    } finally {
      setClosing(false);
    }
  };

  const handleOpen = async () => {
    if (!selectedId) return;
    setError('');
    setOpening(true);
    try {
      const res = await apiClient.post<PeriodRow>(`/accounting/periods/${selectedId}/reopen`);
      if (res.data) hydrate(res.data);
      setSuccess('تم فتح الفترة وإلغاء قيد الإقفال');
      invalidateQuery(['periods']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر فتح الفترة');
    } finally {
      setOpening(false);
    }
  };

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        compact
        registerChrome={false}
        breadcrumbs={[
          { href: '/accounting', label: 'الحسابات' },
          { label: 'إنشاءات الحسابات' },
          { label: 'الفترات المحاسبية' },
        ]}
        title="الفترات المحاسبية"
        docNumber={form.code || (selectedId ? 'تعديل' : 'جديد')}
        statusTone={form.isClosed ? 'danger' : 'success'}
        statusLabel={form.isClosed ? 'مغلقة' : 'مفتوحة'}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSave()}
        savePending={saving}
        canSave={!saving && !closing && !opening}
        hideStandalonePost
        moreMenuItems={[
          { id: 'new', label: 'جديد', onClick: handleNew },
          {
            id: 'del',
            label: 'حذف',
            onClick: () => void handleDelete(),
            disabled: !selectedId,
            destructive: true,
          },
        ]}
        onBrowseList={() => setShowGuide(true)}
        browseListLabel="السابق"
        currentId={selectedId}
      />

      <FormSectionCard
        title="بيانات الفترة"
        subtitle="المسلسل والاسم والتواريخ وحالة السنة"
        icon={CalendarRange}
        className="mb-3 p-3 sm:p-4"
        bodyClassName="!grid-cols-[7rem_minmax(12rem,1fr)_10.5rem_10.5rem]"
      >
        <div
          className={`col-span-full flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
            form.isClosed
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span className="text-sm font-black">
            حالة السنة: {form.isClosed ? 'مغلقة' : 'مفتوحة'}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selectedId || !form.isClosed || opening || closing}
              onClick={() => void handleOpen()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Unlock className="h-3.5 w-3.5" />
              {opening ? 'جاري الفتح…' : 'فتح الفترة المالية'}
            </button>
            <button
              type="button"
              disabled={!selectedId || form.isClosed || opening || closing}
              onClick={() => void handleClose()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Lock className="h-3.5 w-3.5" />
              {closing ? 'جاري الإغلاق…' : 'إغلاق الفترة المالية'}
            </button>
          </div>
        </div>

        <CompactFormField
          label="المسلسل"
          placeholder="إدخل رقم المسلسل"
          value={form.code}
          onChange={(e) => patch({ code: e.target.value })}
        />
        <CompactFormField
          label="الاسم"
          placeholder="إدخل اسم الفترة"
          required
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <DatePickerWithHijri
          label="من تاريخ"
          required
          disabled={startDateLocked}
          value={startDateLocked && !selectedId ? nextStartDate : form.startDate}
          onChange={(value) => patch({ startDate: value })}
        />
        <DatePickerWithHijri
          label="إلى تاريخ"
          required
          value={form.endDate}
          onChange={(value) => patch({ endDate: value })}
        />
      </FormSectionCard>

      <DocumentBrowseDrawer
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="دليل الفترات المحاسبية"
      >
        <PeriodsListSection onSelect={hydrate} selectedId={selectedId} />
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}
