'use client';

import { useEffect, useMemo, useState } from 'react';
import { Coins } from 'lucide-react';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { CurrenciesListSection, type CurrencyRow } from '@/components/accounting/CurrenciesListSection';
import { CURRENCY_CATALOG, findCurrencyCatalog } from '@/lib/accounting/currency-catalog';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';
type FormState = {
  serial: string;
  code: string;
  symbol: string;
  arabicName: string;
  englishName: string;
  exchangeRate: string;
};

function rateToInput(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value);
}

function nextSerialFrom(rows: CurrencyRow[]): string {
  return nextNumericSerial([...rows.map((row) => row.serial), rows.length]);
}

const emptyForm = (serial = ''): FormState => ({
  serial,
  code: '',
  symbol: '',
  arabicName: '',
  englishName: '',
  exchangeRate: '',
});

function CurrenciesPageInner() {
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const { data: currenciesRes } = useApiQuery<CurrencyRow[]>(
    ['currencies', { page: 1, pageSize: 200 }],
    '/accounting/currencies',
    { page: 1, limit: 200 },
    { staleTime: 15_000 }
  );
  const currencies = useMemo(() => currenciesRes?.data ?? [], [currenciesRes?.data]);
  const nextSerial = nextSerialFrom(currencies);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));

  useEffect(() => {
    if (selectedId || currenciesRes == null) return;
    setForm((prev) => (prev.serial === nextSerial ? prev : { ...prev, serial: nextSerial }));
  }, [currenciesRes, nextSerial, selectedId]);

  const resetNew = () => {
    setSelectedId(null);
    setForm(emptyForm(nextSerial));
    setError('');
    setMode('create');
  };

  const hydrate = (row: CurrencyRow) => {
    lockToView();
    const catalog = findCurrencyCatalog(row.code || row.symbol || '');
    setSelectedId(row.id);
    setForm({
      serial: row.serial != null ? String(row.serial) : '',
      code: row.code ?? '',
      symbol: row.symbol || catalog?.symbol || '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      exchangeRate: rateToInput(row.exchangeRate),
    });
    setError('');
    setSuccess('');
    setShowGuide(false);
  };

  const handleNew = () => {
    resetNew();
    setSuccess('');
  };

  const applyCatalog = (code: string) => {
    const item = findCurrencyCatalog(code);
    if (!item) {
      patch({ code });
      return;
    }
    patch({
      code: item.code,
      symbol: item.symbol,
      arabicName: form.arabicName || item.arabicName,
      englishName: form.englishName || item.englishName,
    });
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.code.trim()) {
      setError('يرجى اختيار رمز العملة');
      return;
    }
    if (!form.arabicName.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }

    const serialNumber = Number(form.serial);
    const body = {
      serial: Number.isFinite(serialNumber) && serialNumber > 0 ? serialNumber : undefined,
      code: form.code.trim(),
      symbol: form.symbol.trim() || undefined,
      arabicName: form.arabicName.trim(),
      englishName: form.englishName.trim() || undefined,
      exchangeRate: form.exchangeRate ? parseFloat(form.exchangeRate) : undefined,
    };

    setSaving(true);
    try {
      if (selectedId) {
        await apiClient.put<CurrencyRow>(`/accounting/currencies/${selectedId}`, body);
        setSuccess('تم تحديث العملة');
      } else {
        await apiClient.post<CurrencyRow>('/accounting/currencies', body);
        setSuccess('تم حفظ العملة');
      }
      invalidateQuery(['currencies']);
      resetNew();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('حذف العملة الحالية؟')) return;
    setError('');
    try {
      await apiClient.delete(`/accounting/currencies/${selectedId}`);
      setSuccess('تم حذف العملة');
      invalidateQuery(['currencies']);
      resetNew();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  const advancedFilledCount = [form.englishName, form.exchangeRate].filter(
    (v) => String(v ?? '').trim().length > 0
  ).length;

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/accounting', label: 'الحسابات' },
          { label: 'إنشاءات الحسابات' },
          { label: 'تعريف العملات' },
        ]}
        title="تعريف العملات"
        docNumber={form.serial || (selectedId ? 'تعديل' : 'جديد')}
        statusTone="info"
        statusLabel={selectedId ? 'تعديل' : 'جديد'}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSave()}
        savePending={saving}
        canSave={!isReadOnly && !saving}
        hideStandalonePost
        onEdit={() => {
          if (!selectedId) return;
          unlockForEdit();
        }}
        editDisabled={!selectedId}
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
        title="بيانات العملة"
        subtitle="المسلسل ورمز العملة والاسم"
        icon={Coins}
        className="mb-3 p-3 sm:p-4"
        bodyClassName="!grid-cols-[6.5rem_minmax(13rem,1fr)_minmax(16rem,1.4fr)]"
      >
        <CompactFormField
          label="المسلسل"
          placeholder="تلقائي"
          value={form.serial}
          disabled
        />
        <CompactFormField label="رمز العملة" required>
          <select
            className={compactControlClass}
            value={form.code}
            onChange={(e) => applyCatalog(e.target.value)}
          >
            <option value="">اختر رمز العملة</option>
            {CURRENCY_CATALOG.map((item) => (
              <option key={item.code} value={item.code}>
                {item.symbol} — {item.arabicName} ({item.code})
              </option>
            ))}
          </select>
        </CompactFormField>
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

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="دليل العملات">
        <CurrenciesListSection onSelect={hydrate} selectedId={selectedId} />
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}

export default function CurrenciesPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <CurrenciesPageInner />
    </DocumentModeProvider>
  );
}
