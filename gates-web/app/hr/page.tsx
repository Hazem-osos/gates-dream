'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { staleTimes } from '@/lib/query/query-keys';
import { formatMoney } from '@/lib/hooks/useExecutiveDashboard';
import { toFiniteNumber } from '@/components/dashboard';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  StatusDotPill,
  DASH_PANEL,
  DASH_NUM,
  DASH_GRID,
} from '@/components/dashboard-primitives';

type EmployeeRow = {
  id: string;
  arabicName?: string;
  employeeId?: string | null;
  serial?: string | null;
  isActive?: boolean;
  passportNumber?: string | null;
  identityNumber?: string | null;
};

type AdvanceRow = { id: string; employee?: { arabicName?: string }; amount?: number | string; date?: string; status?: string };
type SalaryRow = { id: string; employee?: { arabicName?: string }; netSalary?: number | string };

export default function HRCommand() {
  useBackendReachability();
  const employeesQ = useApiQuery<EmployeeRow[]>(['hr-hub-employees'], '/hr/employees', { limit: 200, page: 1 }, { staleTime: staleTimes.masterMs });
  const advancesQ = useApiQuery<AdvanceRow[]>(['hr-hub-advances'], '/hr/employee-advances', { limit: 50, page: 1 }, { staleTime: staleTimes.transactionalMs });
  const salariesQ = useApiQuery<SalaryRow[]>(['hr-hub-salaries'], '/hr/monthly-salaries', { limit: 50, page: 1 }, { staleTime: staleTimes.transactionalMs });

  const employees = employeesQ.data?.data ?? [];
  const active = employees.filter((e) => e.isActive !== false);
  const docs = employees.filter((e) => !e.passportNumber || !e.identityNumber);
  const advances = advancesQ.data?.data ?? [];
  const salaries = salariesQ.data?.data ?? [];

  return (
    <CommandCenter
      title="الموارد البشرية — مسير ووثائق"
      module="HR"
      refreshing={employeesQ.isFetching}
      onRefresh={() => {
        void employeesQ.refetch();
        void advancesQ.refetch();
        void salariesQ.refetch();
      }}
      shortcuts={[
        { key: 'F2', label: 'مسير', href: '/hr/monthly-salaries' },
        { key: 'F4', label: 'موظف', href: '/hr/employee-data' },
        { key: 'F6', label: 'سلفة', href: '/hr/employee-advance' },
      ]}
    >
      <MetricBar
        loading={employeesQ.isLoading && !employees.length}
        items={[
          { id: 'pay', label: 'مسير الفترة', value: formatMoney(salaries.reduce((s, r) => s + toFiniteNumber(r.netSalary), 0)), hint: `${salaries.length} سجل` },
          { id: 'act', label: 'على رأس العمل', value: active.length, hint: `من ${employees.length}` },
          { id: 'doc', label: 'وثائق ناقصة', value: docs.length, tone: docs.length ? 'bad' : 'ok' },
          { id: 'adv', label: 'سلف قائمة', value: advances.length, hint: formatMoney(advances.reduce((s, a) => s + toFiniteNumber(a.amount), 0)) },
          { id: 'off', label: 'غير نشط', value: employees.length - active.length },
          { id: 'sal', label: 'سجلات مسير', value: salaries.length },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">حالة القوة</p>
          <SegmentedBar
            segments={[
              { label: 'نشط', value: active.length, color: '#059669' },
              { label: 'غير نشط', value: employees.length - active.length, color: '#94A3B8' },
              { label: 'وثائق ناقصة', value: docs.length, color: '#E11D48' },
            ]}
          />
        </div>
        <TriageQueue
          title="استثناءات HR"
          items={[
            ...docs.slice(0, 8).map((e) => ({
              id: e.id,
              title: e.arabicName ?? e.id,
              meta: !e.identityNumber ? 'هوية ناقصة' : 'جواز ناقص',
              href: '/hr/employee-data',
              tone: 'warn' as const,
            })),
            ...advances.slice(0, 4).map((a) => ({
              id: a.id,
              title: `سلفة ${a.employee?.arabicName ?? ''}`,
              amount: formatMoney(toFiniteNumber(a.amount)),
              href: '/hr/employee-advance',
              tone: 'info' as const,
            })),
          ]}
        />
        <DataGridDense
          title="بطاقات الموظفين"
          loading={employeesQ.isLoading}
          rows={employees.slice(0, 14)}
          columns={[
            { id: 'c', header: 'الكود', cell: (r) => <span className={DASH_NUM}>{r.employeeId || r.serial || r.id.slice(0, 8)}</span> },
            { id: 'n', header: 'الموظف', cell: (r) => r.arabicName ?? '—' },
            {
              id: 's',
              header: 'الحالة',
              cell: (r) =>
                r.isActive === false ? (
                  <StatusDotPill label="غير نشط" tone="neutral" />
                ) : (
                  <StatusDotPill label="نشط" tone="success" />
                ),
            },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
