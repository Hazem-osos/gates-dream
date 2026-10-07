'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type Req = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  calculatedQuantity?: string | null;
  employee?: { arabicName: string };
  leaveType?: { arabicName: string };
};

export default function LeaveRequestsPage() {
  const { data, isLoading } = useApiQuery<Req[]>(['leave-requests'], '/hr/leave/requests');
  const rows = data?.data ?? [];

  return (
    <HrPageChrome title="طلبات الإجازة">
      <FormSectionCard title="القائمة">
        {isLoading ? (
          <p className="text-sm">جاري التحميل…</p>
        ) : (
          <ul className="text-sm space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="border rounded p-2">
                {r.employee?.arabicName} — {r.leaveType?.arabicName} — {r.startDate.slice(0, 10)} →{' '}
                {r.endDate.slice(0, 10)} ({r.calculatedQuantity ?? '—'} يوم) — {r.status}
              </li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
