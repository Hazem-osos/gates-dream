'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

const endpoints = [
  { key: 'balances', path: '/hr/leave/reports/balances', label: 'أرصدة' },
  { key: 'transactions', path: '/hr/leave/reports/transactions', label: 'حركات' },
  { key: 'taken', path: '/hr/leave/reports/taken', label: 'إجازات مأخوذة' },
  { key: 'pending', path: '/hr/leave/reports/pending', label: 'طلبات معلقة' },
  { key: 'expiring', path: '/hr/leave/reports/expiring', label: 'أرصدة تنتهي' },
  { key: 'liability', path: '/hr/leave/reports/liability-facts', label: 'حقائق الالتزام' },
  { key: 'summary', path: '/hr/leave/reports/absence-summary', label: 'ملخص غياب/إجازة' },
] as const;

export default function LeaveReportsPage() {
  const [report, setReport] = useState<(typeof endpoints)[number]['key']>('balances');
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const ep = endpoints.find((e) => e.key === report)!;
  const qs = report === 'summary' ? `?from=${asOf}&to=${asOf}` : `?asOf=${asOf}`;
  const { data, isLoading } = useApiQuery<unknown[]>(['leave-report', report, asOf], `${ep.path}${qs}`);

  return (
    <HrPageChrome title="تقارير الإجازات">
      <FormSectionCard title="اختيار التقرير">
        <div className="flex flex-wrap gap-2 text-sm">
          {endpoints.map((e) => (
            <button
              key={e.key}
              type="button"
              className={`border px-2 py-1 rounded ${report === e.key ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setReport(e.key)}
            >
              {e.label}
            </button>
          ))}
        </div>
        <input type="date" className={`${compactControlClass} mt-2`} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
      </FormSectionCard>
      <FormSectionCard title="النتائج" className="mt-4">
        {isLoading ? <p>جاري التحميل…</p> : (
          <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(data?.data ?? [], null, 2)}</pre>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
