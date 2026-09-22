'use client';

import React, { useEffect, useState } from 'react';
import { Printer, Truck } from 'lucide-react';
import TaxInfoOverlay from '@/components/TaxInfoOverlay';
import { PartiesListSection, type PartyRow } from '@/app/components/accounting/PartiesListSection';
import {
  CompactFormField,
  FormSectionCard,
  compactControlClass,
  Button,
} from '@/components/ui';
import { useClearDocumentQuery, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { ClientMountGate } from '@/lib/hooks/useClientMounted';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { confirmAction } from '@/lib/feedback/confirm';
import { toast } from '@/lib/feedback/toast';
import { printPageContent } from '@/lib/print/printHtml';
import { PartyGroupSelectField } from '@/components/accounting/PartyGroupSelectField';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';
import { useNextMasterSerial } from '@/lib/hooks/useNextMasterSerial';

interface Account {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

type SupplierRecord = {
  id: string;
  serial?: string | null;
  code?: string | null;
  arabicName?: string | null;
  englishName?: string | null;
  supplierType?: string | null;
  how?: string | null;
  nationality?: string | null;
  taxData?: boolean | null;
  taxAuthority?: string | null;
  taxAuthorityName?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  mobile?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  area?: string | null;
  street?: string | null;
  postalCode?: string | null;
  poBox?: string | null;
  mainAccountId?: string | null;
  accountId?: string | null;
  transactionType?: string | null;
  warning?: string | null;
  estimatedBudget?: number | string | null;
  currencyCode?: string | null;
  fileNumber?: string | null;
  registrationNumber?: string | null;
  financier?: string | null;
  discountType?: string | null;
  supplierCategoryId?: string | null;
};

function SupplierPageInner() {
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const quickCreate = useQuickCreateHost('supplier');
  const searchParams = useOwnTabSearchParams();
  const clearDocumentQuery = useClearDocumentQuery();
  const idFromUrl = searchParams.get('id');
  const categoryFromUrl = searchParams.get('categoryId');

  const [showTaxInfo, setShowTaxInfo] = useState(false);
  const [isTaxInfoChecked, setIsTaxInfoChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    serial: '',
    code: '',
    arabicName: '',
    englishName: '',
    supplierType: 'company' as 'company' | 'individual',
    how: 'local' as 'local' | 'export' | 'exempt',
    nationality: '',
    taxData: false,
    taxAuthority: '',
    taxAuthorityName: '',
    phone1: '',
    phone2: '',
    mobile: '',
    fax: '',
    email: '',
    website: '',
    country: '',
    city: '',
    area: '',
    street: '',
    postalCode: '',
    poBox: '',
    mainAccountId: '',
    accountId: '',
    transactionType: '',
    warning: '' as 'debtor' | 'creditor' | '',
    estimatedBudget: '',
    currencyCode: '',
    fileNumber: '',
    registrationNumber: '',
    financier: '',
    discountType: '',
    supplierCategoryId: '',
  });

  useEffect(() => {
    if (!quickCreate.prefillName) return;
    setFormData((prev) => (prev.arabicName ? prev : { ...prev, arabicName: quickCreate.prefillName }));
  }, [quickCreate.prefillName]);

  // Fetch accounts
  const { data: accountsResponse } = useApiQuery<Account[]>(
    ['accounts'],
    '/accounting/accounts',
    { limit: 1000, isActive: true, leafOnly: true }
  );
  const accounts = accountsResponse?.data || [];

  // Fetch currencies
  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data || [];

  const { data: nextSerialResponse } = useNextMasterSerial(
    ['suppliers', 'next-code'],
    '/accounting/suppliers/next-code',
    !selectedId
  );
  const nextSerial = nextSerialResponse?.data?.serial || '';

  useEffect(() => {
    if (selectedId || !nextSerial) return;
    setFormData((prev) => (prev.serial === nextSerial ? prev : { ...prev, serial: nextSerial }));
  }, [nextSerial, selectedId]);

  const { data: categoriesResponse } = useApiQuery<
    { id: string; code?: string; arabicName: string }[]
  >(['supplier-categories'], '/accounting/supplier-categories', {
    limit: 200,
    isActive: true,
  });
  const supplierCategories = categoriesResponse?.data || [];

  useEffect(() => {
    if (selectedId || !categoryFromUrl) return;
    setFormData((prev) =>
      prev.supplierCategoryId ? prev : { ...prev, supplierCategoryId: categoryFromUrl }
    );
  }, [categoryFromUrl, selectedId]);

  useEffect(() => {
    if (!idFromUrl) return;
    let cancelled = false;
    void apiClient.get<SupplierRecord>(`/accounting/suppliers/${idFromUrl}`).then((res) => {
      if (!cancelled && res.data) hydrate(res.data);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر فتح المورد');
    });
    return () => {
      cancelled = true;
    };
  }, [idFromUrl]);

  const blankForm = (
    categoryId = formData.supplierCategoryId || categoryFromUrl || ''
  ) => ({
    serial: '',
    code: '',
    arabicName: '',
    englishName: '',
    supplierType: 'company' as const,
    how: 'local' as const,
    nationality: '',
    taxData: false,
    taxAuthority: '',
    taxAuthorityName: '',
    phone1: '',
    phone2: '',
    mobile: '',
    fax: '',
    email: '',
    website: '',
    country: '',
    city: '',
    area: '',
    street: '',
    postalCode: '',
    poBox: '',
    mainAccountId: '',
    accountId: '',
    transactionType: '',
    warning: '' as const,
    estimatedBudget: '',
    currencyCode: '',
    fileNumber: '',
    registrationNumber: '',
    financier: '',
    discountType: '',
    supplierCategoryId: categoryId,
  });

  const handleTaxInfoCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsTaxInfoChecked(e.target.checked);
    setFormData(prev => ({ ...prev, taxData: e.target.checked }));
    if (e.target.checked) {
      setShowTaxInfo(true);
    }
  };

  const handleCloseTaxInfo = () => {
    setShowTaxInfo(false);
    if (!isTaxInfoChecked) {
      setIsTaxInfoChecked(false);
      setFormData(prev => ({ ...prev, taxData: false }));
    }
  };

  const payload = () => ({
    serial: formData.serial.trim() || undefined,
    code: formData.code.trim() || undefined,
    arabicName: formData.arabicName.trim(),
    englishName: formData.englishName.trim() || undefined,
    supplierType: formData.supplierType,
    how: formData.how,
    nationality: formData.nationality.trim() || undefined,
    taxData: formData.taxData,
    taxAuthority: formData.taxAuthority.trim() || undefined,
    taxAuthorityName: formData.taxAuthorityName.trim() || undefined,
    phone1: formData.phone1.trim() || undefined,
    phone2: formData.phone2.trim() || undefined,
    mobile: formData.mobile.trim() || undefined,
    fax: formData.fax.trim() || undefined,
    email: formData.email.trim() || undefined,
    website: formData.website.trim() || undefined,
    country: formData.country.trim() || undefined,
    city: formData.city.trim() || undefined,
    area: formData.area.trim() || undefined,
    street: formData.street.trim() || undefined,
    postalCode: formData.postalCode.trim() || undefined,
    poBox: formData.poBox.trim() || undefined,
    mainAccountId: formData.mainAccountId || undefined,
    accountId: formData.accountId || undefined,
    transactionType: formData.transactionType || undefined,
    warning: formData.warning || undefined,
    estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : undefined,
    currencyCode: formData.currencyCode || undefined,
    fileNumber: formData.fileNumber.trim() || undefined,
    registrationNumber: formData.registrationNumber.trim() || undefined,
    financier: formData.financier.trim() || undefined,
    discountType: formData.discountType || undefined,
    supplierCategoryId: formData.supplierCategoryId || undefined,
  });

  const hydrate = (row: SupplierRecord) => {
    lockToView();
    setSelectedId(row.id);
    setFormData({
      serial: row.serial || row.code || '',
      code: row.code || row.serial || '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      supplierType: row.supplierType === 'individual' ? 'individual' : 'company',
      how: row.how === 'export' || row.how === 'exempt' ? row.how : 'local',
      nationality: row.nationality ?? '',
      taxData: Boolean(row.taxData),
      taxAuthority: row.taxAuthority ?? '',
      taxAuthorityName: row.taxAuthorityName ?? '',
      phone1: row.phone1 ?? '',
      phone2: row.phone2 ?? '',
      mobile: row.mobile ?? '',
      fax: row.fax ?? '',
      email: row.email ?? '',
      website: row.website ?? '',
      country: row.country ?? '',
      city: row.city ?? '',
      area: row.area ?? '',
      street: row.street ?? '',
      postalCode: row.postalCode ?? '',
      poBox: row.poBox ?? '',
      mainAccountId: row.mainAccountId ?? '',
      accountId: row.accountId ?? '',
      transactionType: row.transactionType ?? '',
      warning: row.warning === 'debtor' || row.warning === 'creditor' ? row.warning : '',
      estimatedBudget: row.estimatedBudget != null ? String(row.estimatedBudget) : '',
      currencyCode: row.currencyCode ?? '',
      fileNumber: row.fileNumber ?? '',
      registrationNumber: row.registrationNumber ?? '',
      financier: row.financier ?? '',
      discountType: row.discountType ?? '',
      supplierCategoryId: row.supplierCategoryId ?? '',
    });
    setIsTaxInfoChecked(Boolean(row.taxData));
    setError('');
    setSuccess('');
    setShowGuide(false);
  };

  const openFromList = async (row: PartyRow) => {
    try {
      const res = await apiClient.get<SupplierRecord>(`/accounting/suppliers/${row.id}`);
      if (res.data) hydrate(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر فتح المورد');
    }
  };

  const handleSave = async () => {
    const code = formData.code.trim();
    const arabicName = formData.arabicName.trim();
    if (!arabicName) {
      toast.error('يرجى إدخال الإسم العربي');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (selectedId) {
        await apiClient.put<SupplierRecord>(
          `/accounting/suppliers/${selectedId}`,
          payload(),
          { skipSuccessNotify: true }
        );
        toast.success('تم حفظ تعديلات المورد');
        invalidateQuery(['suppliers']);
        invalidateQuery(['suppliers', 'guide']);
        invalidateQuery(['accounts']);
        invalidateQuery(['chart-of-accounts']);
        invalidateQuery(['coa-tree']);
        return;
      } else {
        const createdRes = await apiClient.post<SupplierRecord>('/accounting/suppliers', payload(), {
          skipSuccessNotify: true,
        });
        const created = createdRes.data;
        if (created?.id) {
          quickCreate.complete({
            id: created.id,
            label: entityLabel(created.code, created.arabicName),
            arabicName: created.arabicName,
            code: created.code,
            accountId: created.accountId,
          });
        }
        toast.success('تم حفظ المورد — تقدر تضيف التالي');
      }
      invalidateQuery(['suppliers']);
      invalidateQuery(['suppliers', 'next-code']);
      invalidateQuery(['suppliers', 'guide']);
      invalidateQuery(['supplier-categories']);
      invalidateQuery(['accounts']);
      invalidateQuery(['chart-of-accounts']);
      invalidateQuery(['coa-tree']);
      if (!quickCreate.isQuickCreate) handleNew();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    setFormData(blankForm());
    setIsTaxInfoChecked(false);
    setError('');
    setSuccess('');
    setMode('create');
    clearDocumentQuery();
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('حذف بطاقة المورد الحالية؟'))) return;
    setError('');
    try {
      await apiClient.delete(`/accounting/suppliers/${selectedId}`, undefined, {
        skipSuccessNotify: true,
      });
      toast.success('تم حذف المورد');
      invalidateQuery(['suppliers']);
      invalidateQuery(['accounts']);
      invalidateQuery(['chart-of-accounts']);
      invalidateQuery(['coa-tree']);
      handleNew();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/accounting', label: 'الحسابات' },
          { label: 'البطاقات' },
          { label: 'مورد' },
        ]}
        title="بطاقة مورد"
        docNumber={formData.serial || (selectedId ? 'تعديل' : 'جديد')}
        statusTone={selectedId ? (isReadOnly ? 'neutral' : 'info') : 'info'}
        statusLabel={selectedId ? (isReadOnly ? 'عرض' : 'تعديل') : 'جديد'}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSave()}
        savePending={saving}
        canSave={(!selectedId || !isReadOnly) && !saving}
        hideStandalonePost
        extraActions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => void printPageContent('بطاقة مورد')}
          >
            <Printer className="h-3.5 w-3.5" />
            طباعة
          </Button>
        }
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

      <ClientMountGate
        fallback={
          <div
            className="mx-auto max-w-5xl animate-pulse space-y-4 py-8 text-center text-sm text-slate-500"
            aria-busy="true"
          >
            جاري تحميل النموذج…
          </div>
        }
      >
        <form
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <fieldset disabled={Boolean(selectedId) && isReadOnly} className="min-w-0 border-0 p-0">
          <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف المورد" icon={Truck}>
            <CompactFormField
              label="المسلسل"
              value={formData.serial}
              disabled
              readOnly
              placeholder="تلقائي"
            />
            <CompactFormField
              label="الكود"
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="اختياري"
            />
            <CompactFormField
              label="الإسم العربي"
              required
              value={formData.arabicName}
              onChange={(e) => setFormData((prev) => ({ ...prev, arabicName: e.target.value }))}
              placeholder="إدخل الإسم بالعربي"
            />
            <CompactFormField
              label="رقم الهاتف 1"
              value={formData.phone1}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone1: e.target.value }))}
              placeholder="إدخل رقم الهاتف"
            />
            <PartyGroupSelectField
              kind="supplier"
              label="مجموعة المورد"
              value={formData.supplierCategoryId}
              options={supplierCategories}
              onChange={(id) => setFormData((prev) => ({ ...prev, supplierCategoryId: id }))}
              onCreated={() => invalidateQuery(['supplier-categories'])}
            />
            <CompactFormField label="نوع المورد" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'company', label: 'شركة' },
                  { value: 'individual', label: 'فرد' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`${
                      formData.supplierType === opt.value
                        ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                        : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      name="supplierType"
                      value={opt.value}
                      checked={formData.supplierType === opt.value}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          supplierType: e.target.value as 'company' | 'individual',
                        }))
                      }
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CompactFormField>
          </FormSectionCard>

          <FormSectionCard title="الاتصال والعنوان" subtitle="الهاتف والعنوان والحسابات" icon={Truck}>
              <CompactFormField
                label="الإسم الإنجليزي"
                value={formData.englishName}
                onChange={(e) => setFormData((prev) => ({ ...prev, englishName: e.target.value }))}
                placeholder="إدخل الإسم بالإنجليزي"
              />
              <CompactFormField
                label="رقم التسجيل"
                value={formData.registrationNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, registrationNumber: e.target.value }))}
                placeholder="إدخل رقم التسجيل"
              />
              <CompactFormField label="الكيفية" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'local', label: 'محلي' },
                    { value: 'export', label: 'مستورد' },
                    { value: 'exempt', label: 'معفي' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`${
                        formData.how === opt.value
                          ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                          : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                      } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                    >
                      <input
                        type="radio"
                        name="how"
                        value={opt.value}
                        checked={formData.how === opt.value}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            how: e.target.value as 'local' | 'export' | 'exempt',
                          }))
                        }
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </CompactFormField>
              <CompactFormField
                label="الجنسية"
                value={formData.nationality}
                onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                placeholder="إدخل الجنسية"
              />
              <CompactFormField
                label="رقم الهاتف 2"
                value={formData.phone2}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone2: e.target.value }))}
                placeholder="إدخل رقم الهاتف"
              />
              <CompactFormField
                label="رقم الموبايل"
                value={formData.mobile}
                onChange={(e) => setFormData((prev) => ({ ...prev, mobile: e.target.value }))}
                placeholder="إدخل رقم الموبايل"
              />
              <CompactFormField
                label="فاكس"
                value={formData.fax}
                onChange={(e) => setFormData((prev) => ({ ...prev, fax: e.target.value }))}
                placeholder="إدخل رقم الفاكس"
              />
              <CompactFormField
                label="الإيميل"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="إدخل الإيميل"
              />
              <CompactFormField
                label="موقع"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="إدخل الموقع"
              />
              <CompactFormField label="البيانات الضريبية">
                <label className="flex h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={isTaxInfoChecked}
                    onChange={handleTaxInfoCheckboxChange}
                  />
                  <span className="text-xs text-slate-600">تفعيل البيانات الضريبية</span>
                </label>
              </CompactFormField>
              <CompactFormField label="الرئيسي">
                <select
                  className={compactControlClass}
                  value={formData.mainAccountId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mainAccountId: e.target.value }))}
                >
                  <option value="">اختر الحساب الرئيسي</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.arabicName}
                    </option>
                  ))}
                </select>
              </CompactFormField>
              <CompactFormField label="الحساب">
                <select
                  className={compactControlClass}
                  value={formData.accountId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, accountId: e.target.value }))}
                >
                  <option value="">اختر الحساب</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.arabicName}
                    </option>
                  ))}
                </select>
              </CompactFormField>
              <CompactFormField
                label="الدولة"
                value={formData.country}
                onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                placeholder="إدخل الدولة"
              />
              <CompactFormField
                label="المدينة"
                value={formData.city}
                onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="إدخل المدينة"
              />
              <CompactFormField
                label="المنطقة"
                value={formData.area}
                onChange={(e) => setFormData((prev) => ({ ...prev, area: e.target.value }))}
                placeholder="إدخل المنطقة"
              />
              <CompactFormField
                label="الشارع"
                value={formData.street}
                onChange={(e) => setFormData((prev) => ({ ...prev, street: e.target.value }))}
                placeholder="إدخل إسم الشارع"
              />
              <CompactFormField
                label="الرمز البريدي"
                value={formData.postalCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                placeholder="إدخل الرمز البريدي"
              />
              <CompactFormField
                label="صندوق البريد"
                value={formData.poBox}
                onChange={(e) => setFormData((prev) => ({ ...prev, poBox: e.target.value }))}
                placeholder="إدخل صندوق البريد"
              />
              <CompactFormField
                label="موازنة تقديرية"
                type="number"
                step="0.01"
                min="0"
                value={formData.estimatedBudget}
                onChange={(e) => setFormData((prev) => ({ ...prev, estimatedBudget: e.target.value }))}
                placeholder="إدخل الموازنة التقديرية"
              />
              <CompactFormField label="رمز العملة">
                <select
                  className={compactControlClass}
                  value={formData.currencyCode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currencyCode: e.target.value }))}
                >
                  <option value="">اختر العملة</option>
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.code}>
                      {currency.code} - {currency.arabicName}
                    </option>
                  ))}
                </select>
              </CompactFormField>
              <CompactFormField label="تحذير" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'debtor', label: 'مدين' },
                    { value: 'creditor', label: 'دائن' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`${
                        formData.warning === opt.value
                          ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                          : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                      } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                    >
                      <input
                        type="radio"
                        name="warning"
                        value={opt.value}
                        checked={formData.warning === opt.value}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            warning: e.target.value as 'debtor' | 'creditor',
                          }))
                        }
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </CompactFormField>
          </FormSectionCard>

          </fieldset>
        </form>
      </ClientMountGate>
      {showTaxInfo && <TaxInfoOverlay isOpen={showTaxInfo} onClose={handleCloseTaxInfo} />}

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="الموردون السابقون">
        <PartiesListSection
          endpoint="/accounting/suppliers"
          queryKeyPrefix="suppliers"
          emptyTitle="لا يوجد موردون"
          selectedRowId={selectedId}
          onRowActivate={(row) => void openFromList(row)}
        />
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}

export default function SupplierPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <SupplierPageInner />
    </DocumentModeProvider>
  );
}
