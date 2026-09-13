'use client';

import { useState } from 'react';
import { Ruler } from 'lucide-react';
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
} from '@/components/ui';
import { UnitsListSection } from '@/components/inventory/UnitsListSection';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

export default function UnitPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    arabicName: '',
    englishName: '',
  });

  const unitMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/units',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الوحدة بنجاح');
        invalidateQuery(['units']);
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

    const requestBody: Record<string, string | undefined> = {
      code: formData.code || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
    };

    unitMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      code: '',
      arabicName: '',
      englishName: '',
    });
    setError('');
    setSuccess('');
  };

  const advancedFilledCount = [formData.englishName].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: 'rtl' }}>
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="وحدات القياس"
          breadcrumbs={[
            { label: 'المخزون', href: '/inventory' },
            { label: 'التعريفات' },
            { label: 'الوحدات' },
          ]}
        />

        <UnitsListSection />

        <PageHeader title="تعريف الوحدة" className="mb-4" />

        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف الوحدة" icon={Ruler}>
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
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="الإسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => handleInputChange('englishName', e.target.value)}
              placeholder="إدخل الاسم الإنجليزي"
            />
          </div>
        </AdvancedFieldsSection>

        <FormStickyFooter
          onCancel={handleCancel}
          onSave={handleSave}
          saveLoading={unitMutation.isPending}
          status="مسودة"
        />

        {error && <ErrorToast message={error} onClose={() => setError('')} />}
        {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
      </div>
    </div>
  );
}
