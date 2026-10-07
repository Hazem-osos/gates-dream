'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type Policy = { id: string; code: string; arabicName: string; effectiveFrom: string };

export default function AttendancePoliciesPage() {
  const { data, isLoading } = useApiQuery<Policy[]>(['attendance-policies'], '/hr/time/policies');
  const rows = data?.data ?? [];

  return (
    <HrPageChrome title="سياسات الحضور">
      <FormSectionCard title="السياسات">
        {isLoading ? (
          <p>جاري التحميل…</p>
        ) : (
          <ul className="text-sm space-y-1">
            {rows.map((p) => (
              <li key={p.id}>{p.code} — {p.arabicName}</li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
