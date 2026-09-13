'use client';

import React, { useState, useEffect } from 'react';
import { Truck } from 'lucide-react';
import TaxInfoOverlay from '@/components/TaxInfoOverlay';
import { PartiesListSection } from '@/components/accounting/PartiesListSection';
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCompanyGlDefaults } from '@/lib/hooks/useCompanyGlDefaults';
import { ClientMountGate } from '@/lib/hooks/useClientMounted';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

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

export default function SupplierPage() {
  const invalidateQuery = useInvalidateQuery();
  
  const [showTaxInfo, setShowTaxInfo] = useState(false);
  const [isTaxInfoChecked, setIsTaxInfoChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    barcode: '',
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
  });

  const { data: glDefaultsResponse } = useCompanyGlDefaults();
  const glDefaults = glDefaultsResponse?.data;

  useEffect(() => {
    const apId = glDefaults?.apAccountId;
    if (!apId) return;
    setFormData((prev) => {
      if (prev.mainAccountId && prev.accountId) return prev;
      return {
        ...prev,
        mainAccountId: prev.mainAccountId || apId,
        accountId: prev.accountId || apId,
      };
    });
  }, [glDefaults?.apAccountId]);

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

  // Supplier mutation
  const supplierMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/suppliers',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ المورد بنجاح');
        invalidateQuery(['suppliers']);
        // Reset form
        setFormData({
          serial: '',
          code: '',
          arabicName: '',
          englishName: '',
          supplierType: 'company',
          how: 'local',
          nationality: '',
          taxData: false,
          taxAuthority: '',
          taxAuthorityName: '',
          barcode: '',
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
          warning: '',
          estimatedBudget: '',
          currencyCode: '',
          fileNumber: '',
          registrationNumber: '',
          financier: '',
          discountType: '',
        });
        setIsTaxInfoChecked(false);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

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

  const handleSave = async () => {
    if (!formData.arabicName) {
      setError('يرجى إدخال الإسم العربي');
      return;
    }

    try {
      await supplierMutation.mutateAsync({
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
        barcode: formData.barcode || undefined,
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
      });
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleCancel = () => {
    setFormData({
      serial: '',
      code: '',
      arabicName: '',
      englishName: '',
      supplierType: 'company',
      how: 'local',
      nationality: '',
      taxData: false,
      taxAuthority: '',
      taxAuthorityName: '',
      barcode: '',
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
      warning: '',
      estimatedBudget: '',
      currencyCode: '',
      fileNumber: '',
      registrationNumber: '',
      financier: '',
      discountType: '',
    });
    setIsTaxInfoChecked(false);
    setError('');
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
    formData.barcode,
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
    <div className="p-6" style={{ direction: 'rtl' }}>
      <PageHeader
        title="بطاقة مورد"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'البطاقات' },
          { label: 'مورد' },
        ]}
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
          <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف المورد" icon={Truck}>
            <CompactFormField
              label="المسلسل"
              value={formData.serial}
              onChange={(e) => setFormData((prev) => ({ ...prev, serial: e.target.value }))}
              placeholder="إدخل رقم المسلسل"
            />
            <CompactFormField
              label="الكود"
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="إدخل الكود"
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
                label="رقم الباركود"
                value={formData.barcode}
                onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
                placeholder="إدخل رقم الباركود"
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

          <FormStickyFooter
            onCancel={handleCancel}
            onSave={handleSave}
            saveLoading={supplierMutation.isPending}
            status="مسودة"
          />
        </form>
      </ClientMountGate>
      {showTaxInfo && <TaxInfoOverlay isOpen={showTaxInfo} onClose={handleCloseTaxInfo} />}

      <PartiesListSection
        endpoint="/accounting/suppliers"
        queryKeyPrefix="suppliers"
        emptyTitle="لا يوجد موردون"
      />

      {/* Toast Notifications */}
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
    </div>
  );
}
