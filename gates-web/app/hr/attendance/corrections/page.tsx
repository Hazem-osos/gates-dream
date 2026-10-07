'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type Correction = { id: string; status: string; correctionType: string; logicalWorkDate: string };

export default function AttendanceCorrectionsPage() {
  const { data, isLoading } = useApiQuery<Correction[]>(
    ['attendance-corrections'],
    '/hr/time/corrections?status=REQUESTED'
  );
  const items = data?.data ?? [];

  return (
    <HrPageChrome title="تصحيحات الحضور">
      <FormSectionCard title="قيد الاعتماد">
        {isLoading ? (
          <p>جاري التحميل…</p>
        ) : items.length === 0 ? (
          <p>لا توجد طلبات.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {items.map((c) => (
              <li key={c.id}>
                {c.correctionType} — {c.status} — {c.logicalWorkDate?.slice?.(0, 10) ?? c.logicalWorkDate}
              </li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
