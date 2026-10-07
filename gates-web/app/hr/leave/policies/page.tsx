'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type Policy = { id: string; code: string; arabicName: string; effectiveFrom: string };

export default function LeavePoliciesPage() {
  const { data, isLoading } = useApiQuery<Policy[]>(['leave-policies'], '/hr/leave/policies');
  const rows = data?.data ?? [];

  return (
    <HrPageChrome title="سياسات الإجازة">
      <FormSectionCard title="السياسات الفعالة">
        {isLoading ? (
          <p className="text-sm">جاري التحميل…</p>
        ) : (
          <ul className="text-sm space-y-1">
            {rows.map((p) => (
              <li key={p.id}>{p.code} — {p.arabicName} (من {p.effectiveFrom.slice(0, 10)})</li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
