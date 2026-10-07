'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type Run = {
  id: string;
  periodKey: string;
  processed: number;
  credited: number;
  skipped: number;
  failed: number;
  createdAt: string;
};

export default function LeaveAccrualPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const { data, refetch, isLoading } = useApiQuery<Run[]>(['leave-accrual-runs'], '/hr/leave/accrual/runs');
  const runs = data?.data ?? [];

  const run = (sync: boolean) => {
    void apiClient
      .post('/hr/leave/accrual/run', { year: Number(year), month: Number(month), sync })
      .then(() => {
        toast.success(sync ? 'اكتمل الترحيل (متزامن)' : 'تم إرسال المهمة للخلفية');
        void refetch();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل'));
  };

  return (
    <HrPageChrome title="ترحيل الاستحقاق">
      <FormSectionCard title="تشغيل">
        <div className="flex gap-2 text-sm items-center">
          <input className={compactControlClass} value={year} onChange={(e) => setYear(e.target.value)} />
          <input className={compactControlClass} value={month} onChange={(e) => setMonth(e.target.value)} />
          <button type="button" className="underline" onClick={() => run(false)}>تشغيل (Queue)</button>
          <button type="button" className="underline" onClick={() => run(true)}>تشغيل متزامن</button>
        </div>
      </FormSectionCard>
      <FormSectionCard title="سجل التشغيل" className="mt-4">
        {isLoading ? <p>جاري التحميل…</p> : (
          <ul className="text-sm space-y-1">
            {runs.map((r) => (
              <li key={r.id}>
                {r.periodKey}: معالج {r.processed} · مضاف {r.credited} · تخطي {r.skipped} · فشل {r.failed}
              </li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
