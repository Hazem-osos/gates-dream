'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DataGridDense } from '@/components/dashboard-primitives';
import { useApiQuery } from '@/lib/hooks/useApi';

type WorkItemRow = {
  id: string;
  itemNumber: string;
  itemGroupName?: string | null;
  arabicName: string;
  englishName?: string | null;
};

export default function DetailedExtractItemsPage() {
  useBackendReachability();

  const { data: itemsResponse, isLoading, isFetching, refetch } = useApiQuery<WorkItemRow[]>(
    ['extract-work-items-detailed'],
    '/extracts/work-items',
    { limit: 200 }
  );
  const tableData = itemsResponse?.data ?? [];

  return (
    <ExtractsPageChrome
      title="البنود التفصيلية للمستخلصات"
      module="EXTRACTS / ITEMS"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
    >
      <DataGridDense
        title="بنود الأعمال التفصيلية"
        rows={tableData}
        loading={isLoading}
        empty="لا توجد بنود تفصيلية"
        columns={[
          { id: 'code', header: 'كود', cell: (row) => row.itemNumber || '—' },
          { id: 'group', header: 'البند العام', cell: (row) => row.itemGroupName ?? '—' },
          { id: 'ar', header: 'الإسم العربي', cell: (row) => row.arabicName || '—' },
          { id: 'en', header: 'الإسم الإنجليزي', cell: (row) => row.englishName ?? '—' },
        ]}
      />
    </ExtractsPageChrome>
  );
}
