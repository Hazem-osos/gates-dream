'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type ExceptionRow = {
  id: string;
  exceptionType: string;
  status: string;
  logicalWorkDate?: string;
};

export default function AttendanceExceptionsPage() {
  const { data, isLoading } = useApiQuery<ExceptionRow[]>(
    ['attendance-exceptions'],
    '/hr/time/exceptions?status=OPEN'
  );
  const items = data?.data ?? [];

  return (
    <HrPageChrome title="استثناءات الحضور">
      <FormSectionCard title="مفتوحة">
        {isLoading ? (
          <p>جاري التحميل…</p>
        ) : items.length === 0 ? (
          <p>لا توجد استثناءات مفتوحة.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((e) => (
              <li key={e.id}>
                {e.exceptionType} — {e.status}
                {e.logicalWorkDate ? ` (${e.logicalWorkDate})` : ''}
              </li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
