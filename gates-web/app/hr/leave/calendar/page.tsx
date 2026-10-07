'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type CalDay = {
  workDate: string;
  request: {
    status: string;
    employee?: { arabicName: string };
    leaveType?: { arabicName: string };
  };
};

export default function LeaveCalendarPage() {
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const { data, isLoading } = useApiQuery<CalDay[]>(
    ['leave-calendar', from, to],
    `/hr/leave/calendar?from=${from}&to=${to}`
  );
  const rows = data?.data ?? [];

  return (
    <HrPageChrome title="تقويم الإجازات">
      <FormSectionCard title={`${from} — ${to}`}>
        {isLoading ? (
          <p className="text-sm">جاري التحميل…</p>
        ) : (
          <ul className="text-sm space-y-1">
            {rows.map((d, i) => (
              <li key={i}>
                {d.workDate.slice(0, 10)}: {d.request.employee?.arabicName} — {d.request.leaveType?.arabicName} (
                {d.request.status})
              </li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
