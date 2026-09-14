'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
import {
  PageHeader,
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  CrudButtons,
} from '@/components/ui';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { CurrenciesListSection, type CurrencyRow } from '@/components/accounting/CurrenciesListSection';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type FormState = {
  code: string;
  arabicName: string;
  englishName: string;
  exchangeRate: string;
};

const emptyForm = (): FormState => ({
  code: '',
  arabicName: '',
  englishName: '',
  exchangeRate: '',
});

function rateToInput(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value);
}

export default function CurrenciesPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));

  const hydrate = (row: CurrencyRow) => {
    setSelectedId(row.id);
    setForm({
      code: row.code ?? '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      exchangeRate: rateToInput(row.exchangeRate),
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
    if (!form.code.trim()) {
      setError('يرجى إدخال رمز العملة');
      return;
    }
    if (!form.arabicName.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }

    const body = {
      code: form.code.trim(),
      arabicName: form.arabicName.trim(),
      englishName: form.englishName.trim() || undefined,
      exchangeRate: form.exchangeRate ? parseFloat(form.exchangeRate) : undefined,
    };

    setSaving(true);
    try {
      if (selectedId) {
        const res = await apiClient.put<CurrencyRow>(`/accounting/currencies/${selectedId}`, body);
        if (res.data) hydrate(res.data);
        setSuccess('تم تحديث العملة');
      } else {
        const res = await apiClient.post<CurrencyRow>('/accounting/currencies', body);
        if (res.data) hydrate(res.data);
        setSuccess('تم حفظ العملة');
      }
      invalidateQuery(['currencies']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrency = async (id: string) => {
    setError('');
    try {
      await apiClient.delete(`/accounting/currencies/${id}`);
      if (selectedId === id) handleNew();
      setSuccess('تم حذف العملة');
      invalidateQuery(['currencies']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('حذف العملة الحالية؟')) return;
    await deleteCurrency(selectedId);
  };

  const handleDeleteFromGuide = async (row: CurrencyRow) => {
    if (!window.confirm(`حذف العملة «${row.arabicName}»؟`)) return;
    await deleteCurrency(row.id);
  };

  const advancedFilledCount = [form.englishName, form.exchangeRate].filter(
    (v) => String(v ?? '').trim().length > 0
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={{ direction: 'rtl' }}>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <PageHeader
        title="تعريف العملات"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'إنشاءات الحسابات' },
          { label: 'تعريف العملات' },
        ]}
        actions={
          <CrudButtons
            onPrevious={() => setShowGuide(true)}
            onAdd={handleNew}
            onDelete={selectedId ? () => void handleDelete() : undefined}
          />
        }
      />

      <FormSectionCard title="بيانات العملة" subtitle="الرمز والاسم العربي" icon={Coins}>
        <CompactFormField
          label="رمز العملة"
          placeholder="إدخل رمز العملة"
          value={form.code}
          onChange={(e) => patch({ code: e.target.value })}
          required
        />
        <CompactFormField
          label="الإسم العربي"
          placeholder="إدخل الإسم بالعربي"
          value={form.arabicName}
          onChange={(e) => patch({ arabicName: e.target.value })}
          required
        />
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField
            label="الإسم الإنجليزي"
            placeholder="إدخل الإسم الإنجليزي"
            value={form.englishName}
            onChange={(e) => patch({ englishName: e.target.value })}
          />
          <CompactFormField
            label="سعر الصرف"
            type="number"
            placeholder="إدخل سعر الصرف"
            value={form.exchangeRate}
            onChange={(e) => patch({ exchangeRate: e.target.value })}
          />
          <CompactFormField label="العملة الرئيسية =" suffix="جزء عملة">
            <input
              type="text"
              value="100"
              readOnly
              className="h-9 w-full border-0 bg-transparent px-3 text-xs font-medium text-[#094C6B] shadow-none focus:ring-0 sm:text-sm"
            />
          </CompactFormField>
        </div>
      </AdvancedFieldsSection>

      <FormStickyFooter
        onCancel={handleNew}
        onSave={() => void handleSave()}
        saveLoading={saving}
        saveDisabled={saving}
        status={selectedId ? 'تعديل' : 'مسودة'}
      />

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="دليل العملات">
        <CurrenciesListSection
          onSelect={hydrate}
          onDelete={(row) => void handleDeleteFromGuide(row)}
          selectedId={selectedId}
        />
      </DocumentBrowseDrawer>
    </div>
  );
}
