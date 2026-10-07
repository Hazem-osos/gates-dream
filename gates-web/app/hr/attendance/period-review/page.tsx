'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type Review = {
  readiness: string;
  readinessReasons?: string[];
};

export default function AttendancePeriodReviewPage() {
  const [periodStart, setPeriodStart] = useState('2026-06-01');
  const [periodEnd, setPeriodEnd] = useState('2026-06-30');
  const { data, isLoading, refetch } = useApiQuery<Review>(
    ['attendance-period-review', periodStart, periodEnd],
    `/hr/time/period-review?periodStart=${periodStart}&periodEnd=${periodEnd}`
  );
  const review = data?.data;

  const lockPeriod = () => {
    void apiClient
      .post('/hr/time/period-lock', { periodStart, periodEnd })
      .then(() => {
        toast.success('تم قفل الفترة');
        void refetch();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'تعذر القفل'));
  };

  return (
    <HrPageChrome title="مراجعة فترة الحضور">
      <FormSectionCard title="الفترة">
        <div className="flex gap-2 mb-3 text-sm">
          <input type="date" className="border rounded px-2" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <input type="date" className="border rounded px-2" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        {isLoading ? (
          <p>جاري التحميل…</p>
        ) : review ? (
          <div className="space-y-2 text-sm">
            <p>الحالة: {review.readiness}</p>
            {review.readinessReasons?.length ? (
              <ul className="list-disc ps-5">
                {review.readinessReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            {review.readiness === 'READY' ? (
              <button type="button" className="underline text-primary" onClick={lockPeriod}>قفل الفترة</button>
            ) : null}
          </div>
        ) : (
          <p>لا توجد بيانات.</p>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
