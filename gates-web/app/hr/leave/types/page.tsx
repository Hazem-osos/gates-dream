'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type LeaveType = { id: string; code: string; arabicName: string; paidClassification: string };

export default function LeaveTypesPage() {
  const { data, isLoading } = useApiQuery<LeaveType[]>(['leave-types'], '/hr/leave/types');
  const rows = data?.data ?? [];

  return (
    <HrPageChrome title="أنواع الإجازة">
      <FormSectionCard title="الأنواع">
        {isLoading ? (
          <p className="text-sm">جاري التحميل…</p>
        ) : (
          <ul className="text-sm space-y-1">
            {rows.map((t) => (
              <li key={t.id}>{t.code} — {t.arabicName} ({t.paidClassification})</li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
