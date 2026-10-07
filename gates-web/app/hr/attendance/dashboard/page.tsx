'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type Dashboard = {
  date: string;
  attendanceDays: number;
  openExceptions: number;
  unmatchedPunches: number;
};

export default function AttendanceDashboardPage() {
  const { data, isLoading } = useApiQuery<Dashboard>(
    ['attendance-dashboard'],
    '/hr/time/dashboard'
  );
  const m = data?.data;

  return (
    <HrPageChrome title="لوحة الحضور">
      <FormSectionCard title="ملخص اليوم">
        {isLoading ? (
          <p>جاري التحميل…</p>
        ) : m ? (
          <ul className="space-y-1 text-sm">
            <li>التاريخ: {m.date}</li>
            <li>أيام محسوبة: {m.attendanceDays}</li>
            <li>استثناءات مفتوحة: {m.openExceptions}</li>
            <li>بصمات غير مطابقة: {m.unmatchedPunches}</li>
          </ul>
        ) : (
          <p>لا توجد بيانات.</p>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
