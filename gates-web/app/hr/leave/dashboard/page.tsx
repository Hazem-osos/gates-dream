'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type Dashboard = { onLeaveToday: number; pendingRequests: number };

export default function LeaveDashboardPage() {
  const { data, isLoading, error } = useApiQuery<Dashboard>(['leave-dashboard'], '/hr/leave/dashboard');
  const m = data?.data;

  return (
    <HrPageChrome title="لوحة الإجازات">
      <FormSectionCard title="مؤشرات">
        {isLoading && <p className="text-sm">جاري التحميل…</p>}
        {error && <p className="text-sm text-destructive">تعذر تحميل البيانات</p>}
        {m && (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="border rounded p-3">في إجازة اليوم: {m.onLeaveToday}</div>
            <div className="border rounded p-3">طلبات قيد الاعتماد: {m.pendingRequests}</div>
          </div>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
