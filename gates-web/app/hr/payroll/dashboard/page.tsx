'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export default function PayrollDashboardPage() {
  const now = new Date();
  const periodYear = now.getUTCFullYear();
  const periodMonth = now.getUTCMonth() + 1;

  const metrics = useQuery({
    queryKey: ['payroll-metrics', periodYear, periodMonth],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>(
        `/hr/payroll/dashboard/metrics?periodYear=${periodYear}&periodMonth=${periodMonth}`
      );
      return res.data;
    },
  });

  const preview = useQuery({
    queryKey: ['payroll-preview', periodYear, periodMonth],
    queryFn: async () => {
      const res = await apiClient.post<Record<string, unknown>>('/hr/payroll/runs/preview', {
        periodYear,
        periodMonth,
      });
      return res.data;
    },
  });

  const m = metrics.data as {
    payrollEngineMode?: string;
    runStatus?: string;
    gross?: number;
    net?: number;
    employerContributions?: number;
    missingGlMappings?: string[];
  };

  const data = preview.data as {
    included?: number;
    excluded?: number;
    totals?: { gross: number; net: number; deductions: number };
    blockers?: Array<{ employeeId: string; messages: string[] }>;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">لوحة الرواتب (HCM)</h1>
      <p className="text-sm text-muted-foreground">
        المصدر المالي: مسيرات <strong>PayrollRun</strong> — MonthlySalary للعرض التاريخي فقط.
      </p>
      <p className="text-sm">
        وضع المحرك: <strong>{m?.payrollEngineMode ?? '—'}</strong> — مسيرة الفترة:{' '}
        <strong>{m?.runStatus ?? 'NONE'}</strong>
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">جاهز للمعاينة</div>
          <div className="text-2xl font-semibold">{data?.included ?? '—'}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">محجوب</div>
          <div className="text-2xl font-semibold">{data?.excluded ?? '—'}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">صافي تقديري</div>
          <div className="text-2xl font-semibold">{data?.totals?.net?.toLocaleString() ?? '—'}</div>
        </div>
      </div>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/hr/payroll/runs" className="underline">مسيرات HCM (احسب / راجع)</Link>
        <Link href="/hr/monthly-salaries" className="underline">مسيرات الفترة (ترحيل / دفع)</Link>
        <Link href="/hr/payroll/components" className="underline">مكونات الراتب</Link>
        <Link href="/hr/payroll/rules" className="underline">قواعد الرواتب</Link>
        <Link href="/hr/payroll/localization" className="underline">إعدادات التوطين</Link>
      </nav>
      {data?.blockers?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-medium mb-2">معوقات</div>
          <ul className="list-disc pr-5 space-y-1">
            {data.blockers.slice(0, 10).map((b) => (
              <li key={b.employeeId}>{b.employeeId}: {b.messages.join(' · ')}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
