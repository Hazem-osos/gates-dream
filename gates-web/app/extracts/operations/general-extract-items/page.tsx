'use client';

import { useMemo, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ListTree } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, CompactFormField, FormSectionCard } from '@/components/ui';
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

  const { data: itemsResponse, isLoading } = useApiQuery<WorkItemRow[]>(
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
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'البنود العامة للمستخلصات' },
      ]}
      statusLabel="عرض"
      favoriteHref="/extracts/operations/general-extract-items"
      browseList={{
        title: 'البنود العامة',
        apiPath: '/extracts/work-items',
        listKey: 'extract-work-items-browse',
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.itemNumber || r.id) },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.arabicName || '—') },
        ],
        onSelect: () => undefined,
      }}
    >
      <FormSectionCard title="بحث" subtitle="تصفية البنود بالكود أو الاسم" icon={ListTree}>
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
      </FormSectionCard>

      <AppTable
        columns={[
          { id: 'code', header: 'الكود', accessor: 'itemNumber' },
          { id: 'ar', header: 'الإسم العربي', accessor: 'arabicName' },
          { id: 'en', header: 'الإسم الإنجليزي', accessor: 'englishName' },
        ]}
        data={filtered}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="لا توجد بنود"
        exportFileName="general-extract-items"
      />
    </ExtractsPageChrome>
  );
}
