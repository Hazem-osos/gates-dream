'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';

type Shift = {
  id: string;
  code: string;
  arabicName: string;
  startTimeMinutes: number;
  endTimeMinutes: number;
  crossesMidnight: boolean;
  isActive: boolean;
};

function minutesToHHMM(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function hhmmToMinutes(v: string) {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + (m || 0);
}

export default function WorkShiftsPage() {
  const { data, refetch } = useApiQuery<Shift[]>(['hcm-shifts'], '/hr/time/shifts');
  const shifts = data?.data ?? [];
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('17:00');
  const [overnight, setOvernight] = useState(false);

  const onSave = () => {
    void apiClient
      .post('/hr/time/shifts', {
        code,
        arabicName: name,
        startTimeMinutes: hhmmToMinutes(from),
        endTimeMinutes: hhmmToMinutes(to),
        crossesMidnight: overnight,
        isActive: true,
      })
      .then(() => {
        toast.success('تم حفظ الوردية');
        void refetch();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'تعذر الحفظ'));
  };

  return (
    <HrPageChrome title="ورديات العمل" onSave={onSave}>
      <FormSectionCard title="وردية جديدة">
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <input className="border rounded px-2 py-1" placeholder="الكود" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="border rounded px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="border rounded px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
            عبر منتصف الليل
          </label>
        </div>
      </FormSectionCard>
      <FormSectionCard title="الورديات الحالية">
        <ul className="text-sm space-y-1">
          {shifts.map((s) => (
            <li key={s.id}>
              {s.code} — {s.arabicName} ({minutesToHHMM(s.startTimeMinutes)} → {minutesToHHMM(s.endTimeMinutes)})
            </li>
          ))}
        </ul>
      </FormSectionCard>
    </HrPageChrome>
  );
}
