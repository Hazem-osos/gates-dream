'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'lucide-react';
import TaxInfoOverlay from '@/components/TaxInfoOverlay';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { ClientMountGate } from '@/lib/hooks/useClientMounted';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { PartiesListSection, type PartyRow } from '@/app/components/accounting/PartiesListSection';
import type { ApiError } from '@/lib/api/types';
import { PRICE_TIER_LABELS, type PriceTier } from '@/lib/inventory/pricing-engine';
import { customerCardFormSchema } from '@/lib/validation/accounting.schema';
import dynamic from 'next/dynamic';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';
import { printPageContent } from '@/lib/print/printHtml';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';

const CounterpartyOffsetModal = dynamic(
  () =>
    import('@/components/accounting/CounterpartyOffsetModal').then((m) => ({
      default: m.CounterpartyOffsetModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل تسوية الطرف…" /> }
);

interface Account {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Delegate {
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

export default function CustomerPage() {
  const invalidateQuery = useInvalidateQuery();
  
  const [showTaxInfo, setShowTaxInfo] = useState(false);
  const [isTaxInfoChecked, setIsTaxInfoChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [partyDrawer, setPartyDrawer] = useState<PartyRow | null>(null);

  const [formData, setFormData] = useState({
    serial: '',
    code: '',
    arabicName: '',
    englishName: '',
    customerType: 'company' as 'company' | 'individual',
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
    representativeId: '',
    priceListId: '',
    sellingPrice: '',
    transactionType: '',
    warning: '' as 'debtor' | 'creditor' | '',
    estimatedBudget: '',
    creditLimit: '',
    customerCategoryId: '',
    currencyCode: '',
    priceTier: 'RETAIL' as PriceTier,
    linkedSupplierId: '',
  });

  const [offsetOpen, setOffsetOpen] = useState(false);
  const [savedCustomerId, setSavedCustomerId] = useState<string | null>(null);
  const tenantCtx = getTenantContext();

  // Fetch accounts
  const { data: accountsResponse } = useApiQuery<Account[]>(
    ['accounts'],
    '/accounting/accounts',
    { limit: 1000, isActive: true }
  );
  const accounts = accountsResponse?.data || [];

  // Fetch delegates
  const { data: delegatesResponse } = useApiQuery<Delegate[]>(
    ['delegates'],
    '/accounting/delegates',
    { limit: 1000, isActive: true }
  );
  const delegates = delegatesResponse?.data || [];

  // Fetch currencies
  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data || [];

  const { data: categoriesResponse } = useApiQuery<
    { id: string; code?: string; arabicName: string }[]
  >(['customer-categories'], '/accounting/customer-categories', {
    limit: 200,
    isActive: true,
  });
  const customerCategories = categoriesResponse?.data || [];

  const { data: suppliersResponse } = useApiQuery<
    { id: string; code?: string; arabicName: string }[]
  >(['suppliers'], '/accounting/suppliers', { limit: 500, isActive: true });
  const suppliers = suppliersResponse?.data || [];

  const { data: customersResponse } = useApiQuery<{ serial?: string; code?: string }[]>(
    ['customers'],
    '/accounting/customers',
    { limit: 1000, isActive: true }
  );
  const nextPartyCode = useMemo(
    () => nextNumericSerial((customersResponse?.data ?? []).flatMap((row) => [row.serial, row.code])),
    [customersResponse?.data]
  );

  useEffect(() => {
    setFormData((prev) =>
      prev.serial || prev.code ? prev : { ...prev, serial: nextPartyCode, code: nextPartyCode }
    );
  }, [nextPartyCode]);

  // Customer mutation
  const customerMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/customers',
    'POST',
    {
      onSuccess: (res) => {
        const created = res?.data as { id?: string } | undefined;
        if (created?.id) setSavedCustomerId(created.id);
        setSuccess('تم حفظ العميل بنجاح');
        invalidateQuery(['customers']);
        invalidateQuery(['accounts']);
        invalidateQuery(['chart-of-accounts']);
        // Reset form
        setFormData({
          serial: '',
          code: '',
          arabicName: '',
          englishName: '',
          customerType: 'company',
          how: 'local',
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
          representativeId: '',
          priceListId: '',
          sellingPrice: '',
          transactionType: '',
          warning: '',
          estimatedBudget: '',
          creditLimit: '',
          customerCategoryId: '',
          currencyCode: '',
          priceTier: 'RETAIL',
          linkedSupplierId: '',
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
    const parsed = customerCardFormSchema.safeParse(formData);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'يرجى مراجعة بيانات العميل');
      return;
    }

    try {
      await customerMutation.mutateAsync({
        serial: formData.serial || undefined,
        code: formData.code || undefined,
        arabicName: formData.arabicName,
        englishName: formData.englishName || undefined,
        customerType: formData.customerType,
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
        representativeId: formData.representativeId || undefined,
        priceListId: formData.priceListId || undefined,
        sellingPrice: formData.sellingPrice || undefined,
        transactionType: formData.transactionType || undefined,
        warning: formData.warning || undefined,
        estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : undefined,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
        customerCategoryId: formData.customerCategoryId || undefined,
        currencyCode: formData.currencyCode || undefined,
        priceTier: formData.priceTier,
        linkedSupplierId: formData.linkedSupplierId || null,
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
      customerType: 'company',
      how: 'local',
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
      representativeId: '',
      priceListId: '',
      sellingPrice: '',
      transactionType: '',
      warning: '',
      estimatedBudget: '',
      creditLimit: '',
      customerCategoryId: '',
      currencyCode: '',
      priceTier: 'RETAIL',
      linkedSupplierId: '',
    });
    setIsTaxInfoChecked(false);
    setError('');
  };

  const advancedFilledCount = [
    formData.englishName,
    formData.taxData ? '1' : '',
    formData.taxAuthority,
    formData.taxAuthorityName,
    formData.creditLimit,
    formData.mainAccountId,
    formData.accountId,
    formData.email,
    formData.website,
    formData.country,
    formData.city,
    formData.area,
    formData.street,
    formData.postalCode,
    formData.poBox,
    formData.representativeId,
    formData.linkedSupplierId,
    formData.phone2,
    formData.mobile,
    formData.fax,
    formData.warning,
    formData.estimatedBudget,
    formData.currencyCode,
    formData.nationality,
    formData.how !== 'local' ? formData.how : '',
    formData.priceTier !== 'RETAIL' ? formData.priceTier : '',
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  const [showGuide, setShowGuide] = useState(false);

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/accounting', label: 'الحسابات' },
          { label: 'البطاقات' },
          { label: 'عميل' },
        ]}
        title="بطاقة عميل"
        docNumber={formData.serial || (partyDrawer?.id ? 'تعديل' : 'جديد')}
        statusTone="info"
        statusLabel={partyDrawer?.id ? 'تعديل' : 'جديد'}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSave()}
        savePending={customerMutation.isPending}
        canSave={!customerMutation.isPending}
        hideStandalonePost
        moreMenuItems={[{ id: 'new', label: 'جديد', onClick: handleCancel }]}
        extraActions={
          <>
            <button
              type="button"
              className="text-[#2A63D0] hover:underline flex items-center gap-1 bg-transparent border-0 px-2 text-xs font-semibold"
              onClick={() => void printPageContent('بطاقة عميل')}
            >
              طباعة
            </button>
            {formData.linkedSupplierId && (savedCustomerId || partyDrawer?.id) ? (
              <button
                type="button"
                className="text-[#0E79AA] hover:underline flex items-center gap-1 bg-transparent border-0 px-2 text-xs font-semibold"
                onClick={() => setOffsetOpen(true)}
              >
                مقاصة AR/AP
              </button>
            ) : null}
          </>
        }
        onBrowseList={() => setShowGuide(true)}
        browseListLabel="السابق"
        currentId={partyDrawer?.id ?? savedCustomerId}
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
          <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف العميل" icon={User}>
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
              required
              value={formData.phone1}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone1: e.target.value }))}
              placeholder="إدخل رقم الهاتف أو الموبايل"
            />
            <CompactFormField label="مجموعة العميل">
              <select
                className={compactControlClass}
                value={formData.customerCategoryId}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerCategoryId: e.target.value }))}
              >
                <option value="">بدون مجموعة</option>
                {customerCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.code ? `${cat.code} — ${cat.arabicName}` : cat.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField label="نوع العميل" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'company', label: 'شركة' },
                  { value: 'individual', label: 'فرد' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`${
                      formData.customerType === opt.value
                        ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                        : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      name="customerType"
                      value={opt.value}
                      checked={formData.customerType === opt.value}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customerType: e.target.value as 'company' | 'individual',
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
              <CompactFormField label="الرصيد" readOnly placeholder="إدخل الرصيد" />
              <CompactFormField
                label="الإسم الإنجليزي"
                value={formData.englishName}
                onChange={(e) => setFormData((prev) => ({ ...prev, englishName: e.target.value }))}
                placeholder="إدخل الإسم بالإنجليزي"
              />
              <CompactFormField label="الكيفية" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'local', label: 'محلي' },
                    { value: 'export', label: 'مصدر' },
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
              <CompactFormField label="الجنسية">
                <select className={compactControlClass} defaultValue="مصري">
                  <option value="مصري">مصري</option>
                </select>
              </CompactFormField>
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
              {isTaxInfoChecked ? (
                <>
                  <CompactFormField
                    label="مأمورية الضرائب"
                    required
                    value={formData.taxAuthority}
                    onChange={(e) => setFormData((prev) => ({ ...prev, taxAuthority: e.target.value }))}
                    placeholder="إدخل المأمورية أو الرقم الضريبي"
                  />
                  <CompactFormField
                    label="اسم المأمورية"
                    value={formData.taxAuthorityName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, taxAuthorityName: e.target.value }))}
                    placeholder="اسم المأمورية"
                  />
                </>
              ) : null}
              <CompactFormField
                label="حساب العميل"
                hint="يُترك فارغاً ليُنشأ حساب خاص بهذا العميل تحت حساب العملاء"
              >
                <select
                  className={compactControlClass}
                  value={formData.mainAccountId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      mainAccountId: e.target.value,
                      accountId: e.target.value,
                    }))
                  }
                >
                  <option value="">إنشاء حساب تلقائي للعميل</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.arabicName}
                    </option>
                  ))}
                </select>
              </CompactFormField>
              <CompactFormField label="المندوب">
                <select
                  className={compactControlClass}
                  value={formData.representativeId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, representativeId: e.target.value }))}
                >
                  <option value="">اختر المندوب</option>
                  {delegates.map((delegate) => (
                    <option key={delegate.id} value={delegate.id}>
                      {delegate.code} - {delegate.arabicName}
                    </option>
                  ))}
                </select>
              </CompactFormField>
              <CompactFormField label="قائمة الأسعار">
                <select className={compactControlClass} defaultValue="تجاري">
                  <option value="تجاري">تجاري</option>
                </select>
              </CompactFormField>
              <CompactFormField label="سعر البيع">
                <select className={compactControlClass} defaultValue="تجاري">
                  <option value="تجاري">تجاري</option>
                </select>
              </CompactFormField>
              <CompactFormField label="الدولة">
                <select className={compactControlClass} defaultValue="مصر">
                  <option value="مصر">مصر</option>
                </select>
              </CompactFormField>
              <CompactFormField label="المدينة">
                <select className={compactControlClass} defaultValue="القاهرة">
                  <option value="القاهرة">القاهرة</option>
                </select>
              </CompactFormField>
              <CompactFormField label="المنطقة">
                <select className={compactControlClass} defaultValue="مدينة نصر">
                  <option value="مدينة نصر">مدينة نصر</option>
                </select>
              </CompactFormField>
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
                label="حد الائتمان"
                type="number"
                step="0.01"
                min="0"
                value={formData.creditLimit}
                onChange={(e) => setFormData((prev) => ({ ...prev, creditLimit: e.target.value }))}
                placeholder="حد الائتمان"
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
              <CompactFormField label="شريحة التسعير">
                <select
                  className={compactControlClass}
                  value={formData.priceTier}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      priceTier: e.target.value as PriceTier,
                    }))
                  }
                >
                  {(Object.keys(PRICE_TIER_LABELS) as PriceTier[]).map((t) => (
                    <option key={t} value={t}>
                      {PRICE_TIER_LABELS[t]}
                    </option>
                  ))}
                </select>
              </CompactFormField>
              <CompactFormField label="مورد مرتبط (مقاصة)">
                <select
                  className={compactControlClass}
                  value={formData.linkedSupplierId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linkedSupplierId: e.target.value }))}
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.arabicName}
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

        </form>
      </ClientMountGate>
      {showTaxInfo && <TaxInfoOverlay isOpen={showTaxInfo} onClose={handleCloseTaxInfo} />}

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="العملاء السابقون">
        <PartiesListSection
          endpoint="/accounting/customers"
          queryKeyPrefix="customers"
          emptyTitle="لا يوجد عملاء"
          selectedRowId={partyDrawer?.id ?? null}
          onRowActivate={(row) => {
            setPartyDrawer(row);
            setShowGuide(false);
          }}
        />
      </DocumentBrowseDrawer>

      {offsetOpen && tenantCtx.fiscalYearId && (savedCustomerId || partyDrawer?.id) ? (
        <CounterpartyOffsetModal
          open
          onClose={() => setOffsetOpen(false)}
          customerId={(savedCustomerId ?? partyDrawer?.id)!}
          fiscalYearId={tenantCtx.fiscalYearId}
          onSuccess={() => invalidateQuery(['customers'])}
        />
      ) : null}

      {/* Toast Notifications */}
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
    </ErpDocumentLayout>
  );
} 