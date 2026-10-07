'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type LeaveType = { id: string; code: string; arabicName: string };
type EmployeeRow = { id: string; arabicName: string; employmentId?: string };
type Preview = {
  preview: { totalChargeableDays: string; days: Array<{ workDate: string; chargeableDays: string }> };
  balance: { available: string; reserved: string };
};

export default function NewLeaveRequestPage() {
  const { data: typesRes } = useApiQuery<LeaveType[]>(['leave-types'], '/hr/leave/types');
  const { data: empRes } = useApiQuery<EmployeeRow[]>(['employees-leave-req'], '/hr/employees', { limit: 200 });
  const types = typesRes?.data ?? [];
  const employees = empRes?.data ?? [];

  const [employeeId, setEmployeeId] = useState('');
  const [employmentId, setEmploymentId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  const loadPreview = () => {
    if (!employmentId || !leaveTypeId || !startDate || !endDate) {
      toast.error('أكمل الحقول');
      return;
    }
    void apiClient
      .post<Preview>('/hr/leave/requests/preview', {
        employmentId,
        leaveTypeId,
        startDate,
        endDate,
        timezone: 'Africa/Cairo',
      })
      .then((r) => setPreview(r.data))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل المعاينة'));
  };

  const submit = () => {
    if (!employeeId || !employmentId) {
      toast.error('اختر الموظف');
      return;
    }
    void apiClient
      .post('/hr/leave/requests', {
        employeeId,
        employmentId,
        leaveTypeId,
        startDate,
        endDate,
        reason,
        timezone: 'Africa/Cairo',
      })
      .then(() => toast.success('تم إنشاء الطلب'))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل'));
  };

  return (
    <HrPageChrome title="طلب إجازة جديد" onSave={submit}>
      <FormSectionCard title="البيانات">
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <select
            className={compactControlClass}
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              const row = employees.find((x) => x.id === e.target.value);
              setEmploymentId(row?.employmentId ?? '');
            }}
          >
            <option value="">الموظف</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.arabicName}</option>
            ))}
          </select>
          <select className={compactControlClass} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            <option value="">نوع الإجازة</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.arabicName}</option>
            ))}
          </select>
          <input type="date" className={compactControlClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" className={compactControlClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input className={compactControlClass} placeholder="السبب" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button type="button" className="mt-3 text-sm underline" onClick={loadPreview}>معاينة من الخادم</button>
      </FormSectionCard>
      {preview && (
        <FormSectionCard title="المعاينة" className="mt-4">
          <p className="text-sm">أيام مستحقة: {preview.preview.totalChargeableDays}</p>
          <p className="text-sm">متاح: {preview.balance.available} — محجوز: {preview.balance.reserved}</p>
          <ul className="text-xs mt-2">
            {preview.preview.days.map((d) => (
              <li key={d.workDate}>{d.workDate}: {d.chargeableDays}</li>
            ))}
          </ul>
        </FormSectionCard>
      )}
    </HrPageChrome>
  );
}
