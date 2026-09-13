'use client';

import { useMemo, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DataGridDense, DASH_PANEL } from '@/components/dashboard-primitives';
import { CompactFormField } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type WorkItemRow = {
  id: string;
  itemNumber: string;
  arabicName: string;
  englishName?: string | null;
};

export default function GeneralExtractItemsPage() {
  useBackendReachability();
  const [codeQ, setCodeQ] = useState('');
  const [arQ, setArQ] = useState('');
  const [enQ, setEnQ] = useState('');

  const { data: itemsResponse, isLoading, isFetching, refetch } = useApiQuery<WorkItemRow[]>(
    ['extract-work-items'],
    '/extracts/work-items',
    { limit: 200 }
  );
  const tableData = itemsResponse?.data ?? [];
  const filtered = useMemo(() => {
    const c = codeQ.trim().toLowerCase();
    const a = arQ.trim();
    const e = enQ.trim().toLowerCase();
    return tableData.filter((row) => {
      if (c && !(row.itemNumber || '').toLowerCase().includes(c)) return false;
      if (a && !(row.arabicName || '').includes(a)) return false;
      if (e && !(row.englishName || '').toLowerCase().includes(e)) return false;
      return true;
    });
  }, [tableData, codeQ, arQ, enQ]);

  return (
    <ExtractsPageChrome
      title="البنود العامة للمستخلصات"
      module="EXTRACTS / ITEMS"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
    >
      <div className={`${DASH_PANEL} mb-5 p-5`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CompactFormField
            label="الكود"
            placeholder="بحث بالكود"
            value={codeQ}
            onChange={(ev) => setCodeQ(ev.target.value)}
          />
          <CompactFormField
            label="الإسم العربي"
            placeholder="بحث بالاسم"
            value={arQ}
            onChange={(ev) => setArQ(ev.target.value)}
          />
          <CompactFormField
            label="الإسم الإنجليزي"
            placeholder="بحث بالإنجليزي"
            value={enQ}
            onChange={(ev) => setEnQ(ev.target.value)}
          />
        </div>
      </div>
      <DataGridDense
        title="البنود العامة"
        rows={filtered}
        loading={isLoading}
        empty="لا توجد بنود"
        columns={[
          { id: 'code', header: 'كود', cell: (row) => row.itemNumber || '—' },
          { id: 'ar', header: 'الإسم العربي', cell: (row) => row.arabicName || '—' },
          { id: 'en', header: 'الإسم الإنجليزي', cell: (row) => row.englishName ?? '—' },
        ]}
      />
    </ExtractsPageChrome>
  );
}
