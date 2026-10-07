'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type Device = { id: string; code: string; name: string; timezone: string; providerType: string; isActive: boolean };

export default function AttendanceDevicesPage() {
  const { data, isLoading, refetch } = useApiQuery<Device[]>(['attendance-devices'], '/hr/time/devices');
  const devices = data?.data ?? [];
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [tz, setTz] = useState('Africa/Cairo');
  const [mapDeviceId, setMapDeviceId] = useState('');
  const [extCode, setExtCode] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const createDevice = () => {
    void apiClient
      .post('/hr/time/devices', { code, name, timezone: tz, providerType: 'MANUAL' })
      .then(() => {
        toast.success('تم إنشاء الجهاز');
        void refetch();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل'));
  };

  const createMapping = () => {
    void apiClient
      .post(`/hr/time/devices/${mapDeviceId}/mappings`, { externalEmployeeCode: extCode, employeeId })
      .then(() => toast.success('تم ربط الموظف'))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل'));
  };

  return (
    <HrPageChrome title="أجهزة الحضور" onSave={createDevice}>
      <FormSectionCard title="جهاز جديد">
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <input className={compactControlClass} placeholder="الكود" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className={compactControlClass} placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={compactControlClass} value={tz} onChange={(e) => setTz(e.target.value)} />
        </div>
      </FormSectionCard>
      <FormSectionCard title="ربط موظف بالجهاز" className="mt-4">
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <select className={compactControlClass} value={mapDeviceId} onChange={(e) => setMapDeviceId(e.target.value)}>
            <option value="">الجهاز</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.code}</option>
            ))}
          </select>
          <input className={compactControlClass} placeholder="كود البصمة" value={extCode} onChange={(e) => setExtCode(e.target.value)} />
          <input className={compactControlClass} placeholder="employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        </div>
        <button type="button" className="mt-2 text-sm underline" onClick={createMapping}>حفظ الربط</button>
      </FormSectionCard>
      <FormSectionCard title="المصادر" className="mt-4">
        {isLoading ? (
          <p>جاري التحميل…</p>
        ) : (
          <ul className="text-sm space-y-1">
            {devices.map((d) => (
              <li key={d.id}>
                {d.code} — {d.name} ({d.providerType}, {d.timezone})
              </li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
