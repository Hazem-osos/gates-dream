'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useDashboard } from '@/lib/platform-admin/hooks';
import { fmtNum } from '@/lib/platform-admin/format';
import { Card, PageHeader, Stat } from '@/components/platform-admin/ui';
import { LoginEventsTable } from '@/components/platform-admin/LoginEventsTable';

export default function PlatformLoginsPage() {
  const { data } = useDashboard();
  const stats = data?.logins;
  return (
    <>
      <PageHeader title="محاولات الدخول" subtitle="كل دخول ناجح وفاشل لمستخدمي كل الشركات: الوقت، الجهاز، والسبب" />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="دخول ناجح (24 ساعة)" value={fmtNum(stats?.successLast24h)} icon={<ShieldCheck className="h-5 w-5" />} tone="green" />
        <Stat label="محاولات فاشلة (24 ساعة)" value={fmtNum(stats?.failedLast24h)} icon={<ShieldAlert className="h-5 w-5" />} tone={stats?.failedLast24h ? 'red' : 'gray'} />
        <div className="rounded-2xl border border-[#E3EEF4] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">أكثر الحسابات فشلاً (24 ساعة)</p>
          {stats?.mostFailedLast24h.length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {stats.mostFailedLast24h.map((m) => (
                <li key={m.identifier} className="flex justify-between gap-3">
                  <span className="truncate" dir="ltr">{m.identifier}</span>
                  <span className="font-bold text-red-600">{m.attempts}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-400">لا يوجد</p>
          )}
        </div>
      </div>
      <Card>
        <LoginEventsTable />
      </Card>
    </>
  );
}
