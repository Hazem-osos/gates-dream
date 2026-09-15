'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'lucide-react';
import Image from 'next/image';
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';

interface PriceList {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

const EMPTY_FORM = {
  serial: '',
  code: '',
  arabicName: '',
  englishName: '',
  nationality: '',
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
  address: '',
  commissionPercentage: '',
  commissionPolicyId: '',
  groupId: '',
  salesCommissionsId: '',
  priceListId: '',
};

export default function DelegatePage() {
  const invalidateQuery = useInvalidateQuery();
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Fetch price lists
  const { data: priceListsResponse } = useApiQuery<PriceList[]>(
    ['price-lists'],
    '/accounting/price-lists',
    { limit: 1000, isActive: true }
  );
  const priceLists = priceListsResponse?.data || [];

  const { data: delegatesResponse } = useApiQuery<{ serial?: string; code?: string }[]>(
    ['delegates'],
    '/accounting/delegates',
    { limit: 1000, isActive: true }
  );
  const nextDelegateCode = useMemo(
    () => nextNumericSerial((delegatesResponse?.data ?? []).flatMap((row) => [row.serial, row.code])),
    [delegatesResponse?.data]
  );

  useEffect(() => {
    setFormData((prev) =>
      prev.serial || prev.code ? prev : { ...prev, serial: nextDelegateCode, code: nextDelegateCode }
    );
  }, [nextDelegateCode]);

  // Delegate mutation
  const delegateMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/delegates',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ المندوب بنجاح');
        invalidateQuery(['delegates']);
        // Reset form
        setFormData(EMPTY_FORM);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleSave = async () => {
    if (!formData.arabicName) {
      setError('يرجى إدخال الإسم العربي');
      return;
    }

    try {
      await delegateMutation.mutateAsync({
        serial: formData.serial || undefined,
        code: formData.code || undefined,
        arabicName: formData.arabicName,
        englishName: formData.englishName || undefined,
        nationality: formData.nationality || undefined,
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
        address: formData.address || undefined,
        commissionPercentage: formData.commissionPercentage ? parseFloat(formData.commissionPercentage) : undefined,
        commissionPolicyId: formData.commissionPolicyId || undefined,
        groupId: formData.groupId || undefined,
        salesCommissionsId: formData.salesCommissionsId || undefined,
        priceListId: formData.priceListId || undefined,
      });
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
    setError('');
    setSuccess('');
  };

  const advancedFilledCount = [
    formData.englishName,
    formData.nationality,
    formData.barcode,
    formData.phone2,
    formData.mobile,
    formData.fax,
    formData.email,
    formData.website,
    formData.country,
    formData.city,
    formData.area,
    formData.street,
    formData.postalCode,
    formData.poBox,
    formData.address,
    formData.commissionPercentage,
    formData.commissionPolicyId,
    formData.groupId,
    formData.salesCommissionsId,
    formData.priceListId,
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <PageHeader
        title="بطاقة مندوب"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'البطاقات' },
          { label: 'مندوب' },
        ]}
      />

      <form className="w-full text-base">
        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف المندوب" icon={User}>
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
              label="العنوان"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="إدخل العنوان"
            />
            <CompactFormField label="سياسة العمولة">
              <div className="relative">
                <input
                  type="text"
                  placeholder="إدخل سياسة العمولة"
                  className={`${compactControlClass} pl-10`}
                  value={formData.commissionPolicyId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, commissionPolicyId: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-blue-200"
                >
                  <Image src="/magnifying-glass-1.svg" alt="search" width={16} height={16} />
                </button>
              </div>
            </CompactFormField>
            <CompactFormField label="المجموعة">
              <div className="relative">
                <input
                  type="text"
                  placeholder="إدخل المجموعة"
                  className={`${compactControlClass} pl-10`}
                  value={formData.groupId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, groupId: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-blue-200"
                >
                  <Image src="/magnifying-glass-1.svg" alt="search" width={16} height={16} />
                </button>
              </div>
            </CompactFormField>
            <CompactFormField
              label="عمولات المبيعات"
              value={formData.salesCommissionsId}
              onChange={(e) => setFormData((prev) => ({ ...prev, salesCommissionsId: e.target.value }))}
              placeholder="إدخل عمولات المبيعات"
            />
            <CompactFormField label="قائمة الأسعار">
              <select
                className={compactControlClass}
                value={formData.priceListId}
                onChange={(e) => setFormData((prev) => ({ ...prev, priceListId: e.target.value }))}
              >
                <option value="">اختر قائمة الأسعار</option>
                {priceLists.map((priceList) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.code} - {priceList.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="نسبة العمولة"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.commissionPercentage}
              onChange={(e) => setFormData((prev) => ({ ...prev, commissionPercentage: e.target.value }))}
              placeholder="إدخل نسبة العمولة"
            />
          </div>
        </AdvancedFieldsSection>

        <FormStickyFooter
          onCancel={handleCancel}
          onSave={handleSave}
          saveLoading={delegateMutation.isPending}
          status="مسودة"
        />
      </form>

      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
    </div>
  );
}
