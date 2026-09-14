'use client';

import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import {
  PageHeader,
  CompactFormField,
  FormStickyFooter,
  FormSectionCard,
  CrudButtons,
} from '@/components/ui';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { PeriodsListSection, type PeriodRow } from '@/components/accounting/PeriodsListSection';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toApiDate(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

const emptyForm = (): FormState => ({
  code: '',
  name: '',
  startDate: todayIso(),
  endDate: todayIso(),
  isClosed: false,
});

export default function AccountingPeriodsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));

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
    setSelectedId(null);
    setForm(emptyForm());
    setError('');
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
    if (form.startDate >= form.endDate) {
      setError('تاريخ البداية يجب أن يسبق تاريخ النهاية');
      return;
    }

    const body = {
      code: form.code.trim() || form.name.trim(),
      name: form.name.trim(),
      startDate: toApiDate(form.startDate),
      endDate: toApiDate(form.endDate),
      isClosed: form.isClosed,
    };

    setSaving(true);
    try {
      if (selectedId) {
        const res = await apiClient.put<PeriodRow>(`/accounting/periods/${selectedId}`, body);
        if (res.data) hydrate(res.data);
        setSuccess('تم تحديث الفترة المحاسبية');
      } else {
        const res = await apiClient.post<PeriodRow>('/accounting/periods', body);
        if (res.data) {
          hydrate(res.data);
          if (form.isClosed) {
            await apiClient.put<PeriodRow>(`/accounting/periods/${res.data.id}`, { isClosed: true });
            hydrate({ ...res.data, isClosed: true });
          }
        }
        setSuccess('تم حفظ الفترة المحاسبية');
      }
      invalidateQuery(['periods']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const deletePeriod = async (id: string) => {
    setError('');
    try {
      await apiClient.delete(`/accounting/periods/${id}`);
      if (selectedId === id) handleNew();
      setSuccess('تم حذف الفترة');
      invalidateQuery(['periods']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('حذف الفترة المحاسبية الحالية؟')) return;
    await deletePeriod(selectedId);
  };

  const handleDeleteFromGuide = async (row: PeriodRow) => {
    if (!window.confirm(`حذف الفترة «${row.name}»؟`)) return;
    await deletePeriod(row.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={{ direction: 'rtl' }}>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <PageHeader
        title="الفترات المحاسبية"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'إنشاءات الحسابات' },
          { label: 'الفترات المحاسبية' },
        ]}
        actions={
          <CrudButtons
            onPrevious={() => setShowGuide(true)}
            previousLabel="السابق"
            onAdd={handleNew}
            onDelete={selectedId ? () => void handleDelete() : undefined}
          />
        }
      />

      <FormSectionCard title="بيانات الفترة" subtitle="المسلسل والاسم والتواريخ وحالة الفترة" icon={CalendarRange}>
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
          value={form.startDate}
          onChange={(value) => patch({ startDate: value })}
        />
        <DatePickerWithHijri
          label="إلى تاريخ"
          required
          value={form.endDate}
          onChange={(value) => patch({ endDate: value })}
        />
        <div className="col-span-full flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#0A3D5E]">حالة الفترة</span>
          {(
            [
              { closed: false, label: 'مفتوحة' },
              { closed: true, label: 'مغلقة' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={form.isClosed === opt.closed}
              onClick={() => patch({ isClosed: opt.closed })}
              className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                form.isClosed === opt.closed
                  ? 'border-[#0E78AA] bg-[#E8F4FA] text-[#0E78AA]'
                  : 'border-[#D6EAF3] bg-white text-[#0A3D5E] hover:bg-[#F6FBFD]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FormSectionCard>

      <FormStickyFooter
        onCancel={handleNew}
        onSave={() => void handleSave()}
        saveLoading={saving}
        saveDisabled={saving}
        status={selectedId ? 'تعديل' : 'مسودة'}
      />

      <DocumentBrowseDrawer
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="دليل الفترات المحاسبية"
      >
        <PeriodsListSection
          onSelect={hydrate}
          onDelete={(row) => void handleDeleteFromGuide(row)}
          selectedId={selectedId}
        />
      </DocumentBrowseDrawer>
    </div>
  );
}
