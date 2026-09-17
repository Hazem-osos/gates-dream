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
import { confirmAction } from '@/lib/feedback/confirm';
import { toast } from '@/lib/feedback/toast';
import { isEgyptianPound } from '@/lib/accounting/fx-base';
import { useRememberCurrencyRate } from '@/lib/hooks/useRememberCurrencyRate';
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
  const rememberRate = useRememberCurrencyRate();
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
  const definedCodes = useMemo(
    () => new Set(currencies.map((row) => String(row.code ?? '').trim().toUpperCase()).filter(Boolean)),
    [currencies]
  );
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
      exchangeRate: isEgyptianPound(row.code) ? '1' : rateToInput(row.exchangeRate),
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
    const taken = currencies.find(
      (row) => String(row.code ?? '').trim().toUpperCase() === code.trim().toUpperCase()
    );
    if (taken && taken.id !== selectedId) {
      toast.error(
        `العملة «${taken.arabicName}» (${taken.code}) معرّفة بالفعل. عدّلها أو احذفها — لا يمكن تعريف نفس النوع مرتين.`
      );
      hydrate(taken);
      unlockForEdit();
      return;
    }
    if (!item) {
      patch({ code });
      return;
    }
    patch({
      code: item.code,
      symbol: item.symbol,
      arabicName: form.arabicName || item.arabicName,
      englishName: form.englishName || item.englishName,
      exchangeRate: isEgyptianPound(item.code) ? '1' : form.exchangeRate,
    });
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.code.trim()) {
      const message = 'يرجى اختيار رمز العملة';
      setError(message);
      toast.error(message);
      return;
    }
    if (!form.arabicName.trim()) {
      const message = 'يرجى إدخال الاسم العربي';
      setError(message);
      toast.error(message);
      return;
    }
    const duplicate = currencies.find(
      (row) =>
        row.id !== selectedId &&
        String(row.code ?? '').trim().toUpperCase() === form.code.trim().toUpperCase()
    );
    if (duplicate) {
      const message = `العملة «${duplicate.arabicName}» (${duplicate.code}) معرّفة بالفعل. عدّلها أو احذفها — لا يمكن تعريف نفس النوع مرتين.`;
      setError(message);
      toast.error(message);
      return;
    }

    const serialNumber = Number(form.serial);
    const body = {
      serial: Number.isFinite(serialNumber) && serialNumber > 0 ? serialNumber : undefined,
      code: form.code.trim(),
      symbol: form.symbol.trim() || undefined,
      arabicName: form.arabicName.trim(),
      englishName: form.englishName.trim() || undefined,
      exchangeRate: isEgyptianPound(form.code)
        ? 1
        : form.exchangeRate
          ? parseFloat(form.exchangeRate)
          : undefined,
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
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('حذف العملة الحالية؟'))) return;
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
            {CURRENCY_CATALOG.map((item) => {
              const taken = definedCodes.has(item.code) && form.code !== item.code;
              return (
                <option key={item.code} value={item.code} disabled={taken}>
                  {item.symbol} — {item.arabicName} ({item.code})
                  {taken ? ' — معرّفة' : ''}
                </option>
              );
            })}
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
            placeholder={isEgyptianPound(form.code) ? '1' : 'إدخل سعر الصرف'}
            value={isEgyptianPound(form.code) ? '1' : form.exchangeRate}
            disabled={isReadOnly || isEgyptianPound(form.code)}
            hint={isEgyptianPound(form.code) ? 'الجنيه سعر صرفه 1 دائماً ويُحفظ كذلك' : undefined}
            onChange={(e) => {
              patch({ exchangeRate: e.target.value });
              if (selectedId && !isEgyptianPound(form.code)) {
                rememberRate({
                  currencyId: selectedId,
                  currencyCode: form.code,
                  rate: e.target.value,
                });
              }
            }}
            onBlur={() => {
              if (selectedId && !isEgyptianPound(form.code)) {
                rememberRate({
                  currencyId: selectedId,
                  currencyCode: form.code,
                  rate: form.exchangeRate,
                  flush: true,
                });
              }
            }}
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
