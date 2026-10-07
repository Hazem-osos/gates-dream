'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type Row = { employeeName: string; status: string; employmentId: string };

export default function TodayAttendancePage() {
  const { data, isLoading } = useApiQuery<Row[]>(['today-attendance'], '/hr/time/today');
  const rows = data?.data ?? [];

  return (
    <HrPageChrome title="حضور اليوم">
      <FormSectionCard title="الموظفون">
        {isLoading ? (
          <p>جاري التحميل…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right border-b">
                <th className="py-2">الموظف</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employmentId} className="border-b">
                  <td className="py-2">{r.employeeName}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
