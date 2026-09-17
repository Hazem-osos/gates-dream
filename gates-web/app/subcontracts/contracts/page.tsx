'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, Button } from '@/components/ui';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { InvoiceStatusBadge, SubcontractStatusBadge } from '@/components/subcontracts/SubcontractStatusBadge';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp } from '@/lib/subcontracts/money';
import type { SubcontractListItem } from '@/lib/subcontracts/types';

const CreateSubcontractModal = dynamic(
  () =>
    import('@/components/subcontracts/CreateSubcontractModal').then((m) => ({
      default: m.CreateSubcontractModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل عقد المقاول…" /> }
);

export default function SubcontractsListPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useApiQuery<SubcontractListItem[]>(
    queryKeys.subcontracts.list(),
    '/subcontracts',
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const rows = data?.data ?? [];

  return (
    <ExtractsPageChrome
      title="سجل عقود مقاولي الباطن"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/subcontracts', label: 'مقاولو الباطن' },
        { label: 'العقود' },
      ]}
      onNew={() => setCreateOpen(true)}
      statusLabel="عرض"
      favoriteHref="/subcontracts/contracts"
      extraActions={
        <Button iconStart={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          عقد باطن جديد
        </Button>
      }
      browseList={{
        title: 'العقود السابقة',
        apiPath: '/subcontracts',
        listKey: 'subcontracts-browse',
        columns: [
          { id: 'number', header: 'رقم العقد', getValue: (r) => String(r.subcontractNumber || r.id) },
          { id: 'name', header: 'المقاول', getValue: (r) => String((r.subcontractor as { nameAr?: string } | undefined)?.nameAr || '—') },
        ],
        onSelect: (id) => router.push(`/subcontracts/${id}`),
      }}
    >
      <AppTable
        columns={[
          {
            id: 'number',
            header: 'رقم العقد',
            cell: (row) => (
              <Link href={`/subcontracts/${row.id}`} className="font-semibold text-[#0E79AA] underline">
                {row.subcontractNumber}
              </Link>
            ),
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (row) => formatDateAr(row.contractDate),
          },
          {
            id: 'contractor',
            header: 'المقاول',
            cell: (row) => row.subcontractor?.nameAr ?? '—',
          },
          {
            id: 'project',
            header: 'المشروع',
            cell: (row) => `${row.project?.projectCode ?? ''} — ${row.project?.projectName ?? '—'}`,
          },
          {
            id: 'value',
            header: 'قيمة العقد',
            numeric: true,
            cell: (row) => formatEgp(row.totalContractValue),
          },
          {
            id: 'invoices',
            header: 'المستخلصات',
            cell: (row) => {
              const last = row.invoices[row.invoices.length - 1];
              return last ? <InvoiceStatusBadge status={last.status} /> : String(row.invoices.length);
            },
          },
          {
            id: 'status',
            header: 'الحالة',
            cell: (row) => <SubcontractStatusBadge status={row.status} />,
          },
        ]}
        data={rows}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="لا توجد عقود باطن"
        emptyDescription="أنشئ عقد مقاول باطن وربطه بمشروع مقاولات."
        onRowClick={(row) => router.push(`/subcontracts/${row.id}`)}
        exportFileName="subcontracts"
      />

      {createOpen ? (
        <CreateSubcontractModal
          open
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => router.push(`/subcontracts/${id}`)}
        />
      ) : null}
    </ExtractsPageChrome>
  );
}
