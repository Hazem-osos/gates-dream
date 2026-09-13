'use client';

import { useState } from 'react';
import { ActionButtons, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { CommandCenter, StatusDotPill, DASH_PANEL } from '@/components/dashboard-primitives';

type SensorStatus = {
  connected?: boolean;
};

export default function SensorPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    machineId: '',
    sensorType: '',
  });

  const { data: sensorStatusResponse, isFetching, refetch } = useApiQuery<SensorStatus>(
    ['sensor-status'],
    '/manufacturing/sensors/status',
    {},
    { refetchInterval: 5000 }
  );

  const sensorSubscriptionMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/manufacturing/sensors/subscribe',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم الاشتراك في بيانات المستشعر بنجاح');
        invalidateQuery(['sensor-status']);
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الاشتراك');
      },
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!formData.machineId) {
      setError('يرجى إدخال معرف الآلة');
      return;
    }
    if (!formData.sensorType) {
      setError('يرجى إدخال نوع المستشعر');
      return;
    }
    sensorSubscriptionMutation.mutate({
      machineId: formData.machineId,
      sensorType: formData.sensorType,
    });
  };

  const connected = Boolean(sensorStatusResponse?.data?.connected);

  return (
    <CommandCenter
      title="إدارة المستشعرات"
      module="MFG / IOT"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F8', label: 'التشغيل', href: '/manufacturing' },
        { key: 'F2', label: 'أمر تشغيل', href: '/manufacturing/operations/operation' },
      ]}
    >
      <div className={`${DASH_PANEL} mb-5 flex items-center justify-between px-4 py-3`}>
        <p className="text-sm font-semibold text-slate-800">حالة الاتصال</p>
        <StatusDotPill label={connected ? 'متصل' : 'غير متصل'} tone={connected ? 'success' : 'danger'} />
      </div>

      <FormSectionCard title="اشتراك المستشعر" subtitle="اربط آلة ونوع قراءة لمراقبة الخط" bodyClassName="grid-cols-1 sm:grid-cols-2">
        <CompactFormField
          label="معرف الآلة"
          placeholder="إدخل معرف الآلة"
          value={formData.machineId}
          onChange={(e) => setFormData((prev) => ({ ...prev, machineId: e.target.value }))}
        />
        <CompactFormField label="نوع المستشعر">
          <select
            value={formData.sensorType}
            onChange={(e) => setFormData((prev) => ({ ...prev, sensorType: e.target.value }))}
            className={compactControlClass}
          >
            <option value="">اختر نوع المستشعر</option>
            <option value="temperature">درجة الحرارة</option>
            <option value="pressure">الضغط</option>
            <option value="humidity">الرطوبة</option>
            <option value="vibration">الاهتزاز</option>
            <option value="speed">السرعة</option>
          </select>
        </CompactFormField>
      </FormSectionCard>

      <div className="flex justify-end">
        <ActionButtons
          onSave={handleSave}
          onCancel={() => {
            setFormData({ machineId: '', sensorType: '' });
            setError('');
            setSuccess('');
          }}
          saveText={sensorSubscriptionMutation.isPending ? 'جاري الاشتراك...' : 'اشتراك'}
        />
      </div>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </CommandCenter>
  );
}
