"use client";
import * as React from "react";
import { useState } from "react";
import { Coins } from "lucide-react";
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  UserPermissions,
} from "@/components/ui";
import { useApiMutation, useInvalidateQuery } from "@/lib/hooks/useApi";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import type { ApiError } from '@/lib/api/types';

function InputDesign() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    arabicName: '',
    englishName: '',
    exchangeRate: '',
  });

  // Currency mutation
  const currencyMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/currencies',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ العملة بنجاح');
        invalidateQuery(['currencies']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.code) {
      setError('يرجى إدخال رمز العملة');
      return;
    }

    if (!formData.arabicName) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }

    const requestBody: Record<string, unknown> = {
      code: formData.code,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      exchangeRate: formData.exchangeRate ? parseFloat(formData.exchangeRate) : undefined,
    };

    currencyMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      code: '',
      arabicName: '',
      englishName: '',
      exchangeRate: '',
    });
    setError('');
    setSuccess('');
  };

  const advancedFilledCount = [formData.englishName, formData.exchangeRate].filter(
    (v) => String(v ?? '').trim().length > 0
  ).length;

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-xl font-bold text-[#0E78AA] mb-2">إنشاء عملات</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>

      <div className="mb-4">
        <UserPermissions />
      </div>

      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <FormSectionCard title="بيانات العملة" subtitle="الرمز والاسم العربي" icon={Coins}>
        <CompactFormField
          label="رمز العملة"
          placeholder="إدخل رمز العملة"
          value={formData.code}
          onChange={(e) => handleInputChange('code', e.target.value)}
          required
        />
        <CompactFormField
          label="الإسم العربي"
          placeholder="إدخل الإسم بالعربي"
          value={formData.arabicName}
          onChange={(e) => handleInputChange('arabicName', e.target.value)}
          required
        />
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField
            label="الإسم الإنجليزي"
            placeholder="إدخل الإسم الإنجليزي"
            value={formData.englishName}
            onChange={(e) => handleInputChange('englishName', e.target.value)}
          />
          <CompactFormField
            label="سعر الصرف"
            type="number"
            placeholder="إدخل سعر الصرف"
            value={formData.exchangeRate}
            onChange={(e) => handleInputChange('exchangeRate', e.target.value)}
          />
          <CompactFormField label="العملة الرئيسية =" suffix="جزء عملة">
            <input type="text" value="100" readOnly className="h-9 w-full border-0 bg-transparent px-3 text-xs font-medium text-[#094C6B] shadow-none focus:ring-0 sm:text-sm" />
          </CompactFormField>
        </div>
      </AdvancedFieldsSection>

      <FormStickyFooter
        onSave={handleSave}
        onCancel={handleCancel}
        saveText={currencyMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
        saveLoading={currencyMutation.isPending}
      />
    </div>
  );
} 

export default InputDesign;
