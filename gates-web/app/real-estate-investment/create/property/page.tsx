'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

export default function PropertyPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    arabicName: '',
    englishName: '',
    propertyType: '',
    area: '',
    price: '',
    location: '',
    notes: '',
  });

  const propertyMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/real-estate/properties',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ العقار بنجاح');
        invalidateQuery(['properties']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.arabicName) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }

    const requestBody: Record<string, unknown> = {
      code: formData.code || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      propertyType: formData.propertyType || undefined,
      area: formData.area ? parseFloat(formData.area) : undefined,
      price: formData.price ? parseFloat(formData.price) : undefined,
      location: formData.location || undefined,
      notes: formData.notes || undefined,
    };

    propertyMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      code: '',
      arabicName: '',
      englishName: '',
      propertyType: '',
      area: '',
      price: '',
      location: '',
      notes: '',
    });
    setError('');
    setSuccess('');
  };

  const advancedFilledCount = [
    formData.englishName,
    formData.area,
    formData.price,
    formData.location,
    formData.notes,
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: 'rtl' }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 text-right">
          <h1 className="mb-1 text-lg font-bold text-[#0E78AA]">تعريف العقار</h1>
          <div className="h-1 w-full rounded bg-sky-700" />
        </div>

        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف العقار" icon={Building2}>
          <CompactFormField
            label="الكود"
            value={formData.code}
            onChange={(e) => handleInputChange('code', e.target.value)}
            placeholder="إدخل الكود"
          />
          <CompactFormField
            label="الإسم العربي"
            required
            value={formData.arabicName}
            onChange={(e) => handleInputChange('arabicName', e.target.value)}
            placeholder="إدخل الاسم العربي"
          />
          <CompactFormField label="نوع العقار">
            <select
              className={compactControlClass}
              value={formData.propertyType}
              onChange={(e) => handleInputChange('propertyType', e.target.value)}
            >
              <option value="">اختر نوع العقار</option>
              <option value="apartment">شقة</option>
              <option value="villa">فيلا</option>
              <option value="land">أرض</option>
              <option value="commercial">تجاري</option>
            </select>
          </CompactFormField>
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="الإسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => handleInputChange('englishName', e.target.value)}
              placeholder="إدخل الاسم الإنجليزي"
            />
            <CompactFormField
              label="المساحة"
              type="number"
              value={formData.area}
              onChange={(e) => handleInputChange('area', e.target.value)}
              placeholder="إدخل المساحة"
            />
            <CompactFormField
              label="السعر"
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              placeholder="إدخل السعر"
            />
            <CompactFormField
              label="الموقع"
              className="sm:col-span-2"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="إدخل الموقع"
            />
            <CompactFormField label="ملاحظات" className="sm:col-span-2 lg:col-span-3">
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="min-h-[72px] w-full resize-none rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 sm:text-sm"
                placeholder="أدخل الملاحظات هنا..."
              />
            </CompactFormField>
          </div>
        </AdvancedFieldsSection>

        <FormStickyFooter
          onCancel={handleCancel}
          onSave={handleSave}
          saveLoading={propertyMutation.isPending}
          status="مسودة"
        />

        {error && <ErrorToast message={error} onClose={() => setError('')} />}
        {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
      </div>
    </div>
  );
}
