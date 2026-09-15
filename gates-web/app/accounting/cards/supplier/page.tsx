'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import TaxInfoOverlay from '@/components/TaxInfoOverlay';
import { PartiesListSection, type PartyRow } from '@/app/components/accounting/PartiesListSection';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { ClientMountGate } from '@/lib/hooks/useClientMounted';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';

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

  // Fetch accounts
  const { data: accountsResponse } = useApiQuery<Account[]>(
    ['accounts'],
    '/accounting/accounts',
    { limit: 1000, isActive: true }
  );
  const accounts = accountsResponse?.data || [];

  // Fetch currencies
  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data || [];

  const { data: categoriesResponse } = useApiQuery<
    { id: string; code?: string; arabicName: string }[]
  >(['supplier-categories'], '/accounting/supplier-categories', {
    limit: 200,
    isActive: true,
  });
  const supplierCategories = categoriesResponse?.data || [];

  const { data: suppliersListResponse } = useApiQuery<{ serial?: string; code?: string }[]>(
    ['suppliers'],
    '/accounting/suppliers',
    { limit: 1000, isActive: true }
  );
  const nextPartyCode = useMemo(
    () =>
      nextNumericSerial((suppliersListResponse?.data ?? []).flatMap((row) => [row.serial, row.code])),
    [suppliersListResponse?.data]
  );

  useEffect(() => {
    setFormData((prev) =>
      prev.serial || prev.code ? prev : { ...prev, serial: nextPartyCode, code: nextPartyCode }
    );
  }, [nextPartyCode]);

  const blankForm = (serial = nextPartyCode) => ({
    serial,
    code: serial,
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
    supplierCategoryId: '',
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
    serial: formData.serial || undefined,
    code: formData.code || undefined,
    arabicName: formData.arabicName,
    englishName: formData.englishName || undefined,
    supplierType: formData.supplierType,
    how: formData.how,
    nationality: formData.nationality || undefined,
    taxData: formData.taxData,
    taxAuthority: formData.taxAuthority || undefined,
    taxAuthorityName: formData.taxAuthorityName || undefined,
    phone1: formData.phone1 || undefined,
    phone2: formData.phone2 || undefined,
    mobile: formData.mobile || undefined,
    fax: formData.fax || undefined,
    email: formData.email || undefined,
    website: formData.website || undefined,
    country: formData.country || undefined,
    city: formData.city || undefined,
    area: formData.area || undefined,
    street: formData.street || undefined,
    postalCode: formData.postalCode || undefined,
    poBox: formData.poBox || undefined,
    mainAccountId: formData.mainAccountId || undefined,
    accountId: formData.accountId || undefined,
    transactionType: formData.transactionType || undefined,
    warning: formData.warning || undefined,
    estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : undefined,
    currencyCode: formData.currencyCode || undefined,
    fileNumber: formData.fileNumber || undefined,
    registrationNumber: formData.registrationNumber || undefined,
    financier: formData.financier || undefined,
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
    if (!formData.arabicName) {
      setError('يرجى إدخال الإسم العربي');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (selectedId) {
        const res = await apiClient.put<SupplierRecord>(`/accounting/suppliers/${selectedId}`, payload());
        if (res.data) hydrate(res.data);
        setSuccess('تم تحديث المورد');
      } else {
        await apiClient.post('/accounting/suppliers', payload());
        setSuccess('تم حفظ المورد بنجاح');
        setFormData(blankForm());
        setIsTaxInfoChecked(false);
        setSelectedId(null);
        setMode('create');
      }
      invalidateQuery(['suppliers']);
      invalidateQuery(['accounts']);
      invalidateQuery(['chart-of-accounts']);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ');
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
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm('حذف بطاقة المورد الحالية؟')) return;
    setError('');
    try {
      await apiClient.delete(`/accounting/suppliers/${selectedId}`);
      setSuccess('تم حذف المورد');
      invalidateQuery(['suppliers']);
      handleNew();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  const advancedFilledCount = [
    formData.englishName,
    formData.registrationNumber,
    formData.taxData ? '1' : '',
    formData.taxAuthority,
    formData.mainAccountId,
    formData.accountId,
    formData.email,
    formData.website,
    formData.phone2,
    formData.mobile,
    formData.fax,
    formData.nationality,
    formData.country,
    formData.city,
    formData.area,
    formData.street,
    formData.postalCode,
    formData.poBox,
    formData.warning,
    formData.estimatedBudget,
    formData.currencyCode,
    formData.how !== 'local' ? formData.how : '',
  ].filter((v) => String(v ?? '').trim().length > 0).length;

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
        <form autoComplete="off" data-1p-ignore data-lpignore="true">
          <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0">
          <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف المورد" icon={Truck}>
            <CompactFormField
              label="المسلسل"
              value={formData.serial}
              disabled
              placeholder="تلقائي"
            />
            <CompactFormField
              label="الكود"
              value={formData.code}
              disabled
              placeholder="تلقائي"
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
            <CompactFormField label="مجموعة المورد">
              <select
                className={compactControlClass}
                value={formData.supplierCategoryId}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplierCategoryId: e.target.value }))}
              >
                <option value="">بدون مجموعة</option>
                {supplierCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.code ? `${cat.code} — ${cat.arabicName}` : cat.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
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

          <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            </div>
          </AdvancedFieldsSection>

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
