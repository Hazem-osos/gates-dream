'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable } from '@/components/ui';
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

  const { data: itemsResponse, isLoading } = useApiQuery<WorkItemRow[]>(
    ['extract-work-items-detailed'],
    '/extracts/work-items',
    { limit: 200 }
  );
  const tableData = itemsResponse?.data ?? [];

  return (
    <ExtractsPageChrome
      title="البنود التفصيلية للمستخلص"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'البنود التفصيلية للمستخلص' },
      ]}
      statusLabel="عرض"
      favoriteHref="/extracts/operations/detailed-extract-items"
      browseList={{
        title: 'البنود التفصيلية',
        apiPath: '/extracts/work-items',
        listKey: 'extract-work-items-detailed-browse',
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.itemNumber || r.id) },
          { id: 'group', header: 'البند العام', getValue: (r) => String(r.itemGroupName || '—') },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.arabicName || '—') },
        ],
        onSelect: () => undefined,
      }}
    >
      <AppTable
        columns={[
          { id: 'code', header: 'الكود', accessor: 'itemNumber' },
          { id: 'group', header: 'البند العام', accessor: 'itemGroupName' },
          { id: 'ar', header: 'الإسم العربي', accessor: 'arabicName' },
          { id: 'en', header: 'الإسم الإنجليزي', accessor: 'englishName' },
        ]}
        data={tableData}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="لا توجد بنود تفصيلية"
        exportFileName="detailed-extract-items"
      />
    </ExtractsPageChrome>
  );
}
