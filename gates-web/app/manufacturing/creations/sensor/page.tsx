'use client';

import { useState } from 'react';
import { CompactFormField, FormSectionCard, compactControlClass, StatusBadge } from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import {
  ManufacturingPageChrome,
  MfgMetric,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';

type SensorStatus = {
  connected?: boolean;
};

const SENSOR_TYPES = [
  { value: 'temperature', label: 'درجة الحرارة' },
  { value: 'pressure', label: 'الضغط' },
  { value: 'humidity', label: 'الرطوبة' },
  { value: 'vibration', label: 'الاهتزاز' },
  { value: 'speed', label: 'السرعة' },
];

export default function SensorPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    machineId: '',
    sensorType: '',
  });

  const { data: sensorStatusResponse, isFetching } = useApiQuery<SensorStatus>(
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
  const sensorLabel = SENSOR_TYPES.find((s) => s.value === formData.sensorType)?.label ?? '—';

  return (
    <ManufacturingPageChrome
      title="إدارة المستشعرات"
      statusLabel={connected ? 'متصل' : 'غير متصل'}
      statusTone={connected ? 'success' : 'danger'}
      favoriteHref="/manufacturing/creations/sensor"
      onSave={handleSave}
      savePending={sensorSubscriptionMutation.isPending || isFetching}
      saveLabel="اشتراك"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MfgMetric label="حالة الاتصال" value={connected ? 'متصل' : 'غير متصل'} tone={connected ? 'ok' : 'bad'} />
        <MfgMetric label="معرف الآلة" value={formData.machineId || '—'} />
        <MfgMetric label="نوع المستشعر" value={sensorLabel} />
      </div>

      <FormSectionCard
        title="اشتراك المستشعر"
        subtitle="اربط آلة ونوع قراءة لمراقبة الخط"
        bodyClassName="grid-cols-1 sm:grid-cols-2"
      >
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
            {SENSOR_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </CompactFormField>
      </FormSectionCard>

      <MfgTableCard
        title="حالة الخط"
        toolbar={<StatusBadge compact label={connected ? 'متصل' : 'غير متصل'} tone={connected ? 'success' : 'danger'} />}
      >
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>الحقل</th>
              <th className={mfgThClass}>القيمة</th>
            </tr>
          </thead>
          <tbody>
            <tr className={mfgTrClass}>
              <td className={mfgTdClass}>الاتصال</td>
              <td className={mfgTdClass}>{connected ? 'متصل' : 'غير متصل'}</td>
            </tr>
            <tr className={mfgTrClass}>
              <td className={mfgTdClass}>الآلة</td>
              <td className={mfgTdClass}>{formData.machineId || '—'}</td>
            </tr>
            <tr className={mfgTrClass}>
              <td className={mfgTdClass}>المستشعر</td>
              <td className={mfgTdClass}>{sensorLabel}</td>
            </tr>
          </tbody>
        </table>
      </MfgTableCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </ManufacturingPageChrome>
  );
}
