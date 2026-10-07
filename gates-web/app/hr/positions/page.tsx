'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DataGridDense } from '@/components/dashboard-primitives';
import { useApiQuery } from '@/lib/hooks/useApi';

type PositionRow = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  department?: { arabicName?: string } | null;
  jobTitle?: { arabicName?: string } | null;
  reportsTo?: { code?: string; arabicName?: string } | null;
};

export default function HrPositionsPage() {
  const { data, isLoading } = useApiQuery<PositionRow[]>(['hr-positions'], '/hr/positions');
  const rows = data?.data ?? [];

  return (
    <HrPageChrome title="المناصب الوظيفية">
      <DataGridDense
        title="المناصب"
        loading={isLoading}
        columns={[
          { id: 'code', header: 'الكود', cell: (r) => r.code },
          { id: 'name', header: 'المنصب', cell: (r) => r.arabicName },
          { id: 'dept', header: 'الوحدة', cell: (r) => r.department?.arabicName ?? '—' },
          { id: 'title', header: 'المسمى', cell: (r) => r.jobTitle?.arabicName ?? '—' },
          { id: 'mgr', header: 'يتبع لـ', cell: (r) => r.reportsTo?.arabicName ?? '—' },
        ]}
        rows={rows}
      />
    </HrPageChrome>
  );
}
