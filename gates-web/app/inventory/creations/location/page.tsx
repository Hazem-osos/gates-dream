'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

interface Warehouse {
  id: string;
  code?: string;
  arabicName?: string;
}

export default function LocationPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    warehouseId: '',
    code: '',
    arabicName: '',
    englishName: '',
  });

  // Fetch warehouses
  const { data: warehousesResponse } = useApiQuery<Warehouse[]>(
    ['warehouses'],
    '/inventory/warehouses',
    { limit: 1000, isActive: true }
  );
  const warehouses = warehousesResponse?.data || [];

  // Location mutation
  const locationMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/locations',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الموقع بنجاح');
        invalidateQuery(['locations']);
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

    if (!formData.warehouseId) {
      setError('يرجى اختيار المخزن');
      return;
    }

    if (!formData.arabicName) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }

    const requestBody: Record<string, unknown> = {
      warehouseId: formData.warehouseId,
      code: formData.code || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
    };

    locationMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      warehouseId: '',
      code: '',
      arabicName: '',
      englishName: '',
    });
    setError('');
    setSuccess('');
  };

  const advancedFilledCount = [formData.englishName].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <MasterCardShell
      title="تعريف الموقع"
      breadcrumbs={[
        { label: 'المخزون', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'الموقع' },
      ]}
      docNumber={formData.code || 'جديد'}
      statusLabel={formData.arabicName ? 'تعديل' : 'جديد'}
      onSave={handleSave}
      savePending={locationMutation.isPending}
      canSave={!locationMutation.isPending}
      onNew={handleCancel}
      favoriteHref="/inventory/creations/location"
    >
        <form className="w-full text-base">
          <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف الموقع" icon={MapPin}>
            <CompactFormField label="المخزن">
              <select
                value={formData.warehouseId}
                onChange={(e) => handleInputChange('warehouseId', e.target.value)}
                className={compactControlClass}
                required
              >
                <option value="">اختر المخزن</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.arabicName || wh.code}
                  </option>
                ))}
              </select>
            </CompactFormField>
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

        </form>

        {error && <ErrorToast message={error} onClose={() => setError('')} />}
        {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
    </MasterCardShell>
  );
}
