'use client';

import { useRouter } from 'next/navigation';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApiQuery } from '@/lib/hooks/useApi';
import { TENDER_STATUS_AR } from '@/components/contracting/tender/tender-labels';

type TenderRow = {
  id: string;
  tenderNumber: string;
  nameAr: string;
  status: string;
  location?: string | null;
  consultantName?: string | null;
  issueDate?: string | null;
  createdAt?: string;
  customer: { arabicName: string };
};

export default function TendersListPage() {
  const router = useRouter();
  const q = useApiQuery<TenderRow[]>(['contracting-tenders'], '/contracting/tenders');
  const rows = q.data?.data ?? [];

  return (
    <ExtractsPageChrome
      title="العطاءات"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'العطاءات' },
      ]}
      statusLabel="عرض"
      favoriteHref="/contracting/tenders"
      hideSave
      onNew={() => router.push('/contracting/tenders/new')}
    >
      <AppTable
        columns={[
          { id: 'tenderNumber', header: 'رقم العطاء', accessor: 'tenderNumber' },
          { id: 'customer', header: 'المالك', cell: (r) => r.customer.arabicName },
          { id: 'nameAr', header: 'الاسم', accessor: 'nameAr' },
          { id: 'consultantName', header: 'الاستشاري', cell: (r) => r.consultantName || '—' },
          { id: 'location', header: 'الموقع', cell: (r) => r.location || '—' },
          { id: 'issueDate', header: 'تاريخ التحرير', cell: (r) => (r.issueDate ?? r.createdAt)?.slice(0, 10) || '—' },
          {
            id: 'status',
            header: 'الحالة',
            cell: (r) => (
              <StatusBadge
                label={TENDER_STATUS_AR[r.status] ?? r.status}
                tone={r.status === 'AWARDED' ? 'success' : r.status === 'LOST' ? 'danger' : 'info'}
                compact
              />
            ),
          },
        ]}
        data={rows}
        getRowKey={(r) => r.id}
        isLoading={q.isLoading}
        emptyTitle="لا توجد عطاءات"
        emptyDescription="أنشئ عطاءاً جديداً لبدء الدراسة والتسعير والترسية."
        exportFileName="tenders"
        onRowClick={(r) => router.push(`/contracting/tenders/${r.id}`)}
      />
    </ExtractsPageChrome>
  );
}
