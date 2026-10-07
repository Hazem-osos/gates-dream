'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';

type Schedule = { id: string; code: string; arabicName: string; scheduleType: string };
type Shift = { id: string; code: string; arabicName: string };
type Assignment = {
  id: string;
  employmentId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  schedule: Schedule;
};

const DOW = [
  { k: '0', l: 'أحد' },
  { k: '1', l: 'إثنين' },
  { k: '2', l: 'ثلاثاء' },
  { k: '3', l: 'أربعاء' },
  { k: '4', l: 'خميس' },
  { k: '5', l: 'جمعة' },
  { k: '6', l: 'سبت' },
];

export default function AttendanceSchedulesPage() {
  const { data: schedData, refetch: refSched } = useApiQuery<Schedule[]>(['attendance-schedules'], '/hr/time/schedules');
  const { data: shiftData } = useApiQuery<Shift[]>(['hcm-shifts-sched'], '/hr/time/shifts');
  const { data: assignData, refetch: refAssign } = useApiQuery<Assignment[]>(
    ['schedule-assignments'],
    '/hr/time/schedule-assignments'
  );
  const schedules = schedData?.data ?? [];
  const shifts = shiftData?.data ?? [];
  const assignments = assignData?.data ?? [];

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'FIXED_WEEKLY' | 'ROTATION'>('FIXED_WEEKLY');
  const [weekly, setWeekly] = useState<Record<string, string>>({});
  const [anchorDate, setAnchorDate] = useState('2026-01-01');
  const [cycleDays, setCycleDays] = useState<string[]>(['', '', '', '', '']);

  const [assignEmploymentId, setAssignEmploymentId] = useState('');
  const [assignScheduleId, setAssignScheduleId] = useState('');
  const [assignFrom, setAssignFrom] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const saveSchedule = () => {
    const pattern =
      type === 'ROTATION'
        ? { rotation: { anchorDate, cycleDays: cycleDays.map((id) => id || null) } }
        : { weekly };
    void apiClient
      .post('/hr/time/schedules', { code, arabicName: name, scheduleType: type, pattern })
      .then(() => {
        toast.success('تم حفظ الجدول');
        void refSched();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ'));
  };

  const saveAssignment = () => {
    void apiClient
      .post('/hr/time/schedule-assignments', {
        employmentId: assignEmploymentId,
        scheduleId: assignScheduleId,
        effectiveFrom: assignFrom,
        effectiveTo: assignTo || null,
      })
      .then(() => {
        toast.success('تم تعيين الجدول');
        void refAssign();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'تعارض أو خطأ'));
  };

  return (
    <HrPageChrome title="جداول العمل" onSave={saveSchedule}>
      <FormSectionCard title="جدول جديد">
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <input className={compactControlClass} placeholder="الكود" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className={compactControlClass} placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={compactControlClass} value={type} onChange={(e) => setType(e.target.value as 'FIXED_WEEKLY' | 'ROTATION')}>
            <option value="FIXED_WEEKLY">أسبوعي ثابت</option>
            <option value="ROTATION">تدوير</option>
          </select>
        </div>
        {type === 'FIXED_WEEKLY' ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
            {DOW.map((d) => (
              <label key={d.k} className="flex items-center gap-2">
                <span className="w-16">{d.l}</span>
                <select
                  className={compactControlClass}
                  value={weekly[d.k] ?? ''}
                  onChange={(e) => setWeekly({ ...weekly, [d.k]: e.target.value })}
                >
                  <option value="">— راحة —</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.code}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            <input className={compactControlClass} type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
            {cycleDays.map((c, i) => (
              <select
                key={i}
                className={compactControlClass}
                value={c}
                onChange={(e) => {
                  const next = [...cycleDays];
                  next[i] = e.target.value;
                  setCycleDays(next);
                }}
              >
                <option value="">يوم {i + 1}: راحة</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.code}</option>
                ))}
              </select>
            ))}
          </div>
        )}
      </FormSectionCard>

      <FormSectionCard title="تعيين موظف" className="mt-4">
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <input className={compactControlClass} placeholder="employmentId" value={assignEmploymentId} onChange={(e) => setAssignEmploymentId(e.target.value)} />
          <select className={compactControlClass} value={assignScheduleId} onChange={(e) => setAssignScheduleId(e.target.value)}>
            <option value="">اختر جدولاً</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>{s.code}</option>
            ))}
          </select>
          <input className={compactControlClass} type="date" value={assignFrom} onChange={(e) => setAssignFrom(e.target.value)} />
          <input className={compactControlClass} type="date" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} />
        </div>
        <button type="button" className="mt-2 text-sm underline" onClick={saveAssignment}>حفظ التعيين</button>
      </FormSectionCard>

      <FormSectionCard title="الجداول والتعيينات" className="mt-4">
        <h4 className="font-medium text-sm mb-2">الجداول</h4>
        <ul className="text-sm space-y-1 mb-4">
          {schedules.map((s) => (
            <li key={s.id}>{s.code} — {s.arabicName} ({s.scheduleType})</li>
          ))}
        </ul>
        <h4 className="font-medium text-sm mb-2">التعيينات</h4>
        <ul className="text-sm space-y-1">
          {assignments.map((a) => (
            <li key={a.id}>
              {a.schedule.code} — من {a.effectiveFrom.slice(0, 10)}
              {a.effectiveTo ? ` إلى ${a.effectiveTo.slice(0, 10)}` : ' (مفتوح)'}
            </li>
          ))}
        </ul>
      </FormSectionCard>
    </HrPageChrome>
  );
}
