'use client';

import { useRouter } from 'next/navigation';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ContractingProject } from '@/lib/contracting/types';
import { formatEgp } from '@/lib/subcontracts/money';

export default function ContractingProjectsPage() {
  const router = useRouter();
  const { data, isLoading } = useApiQuery<ContractingProject[]>(
    queryKeys.contracting.projects(),
    '/contracting/projects',
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const projects = data?.data ?? [];

  return (
    <ExtractsPageChrome
      title="مساحة المشروع التنفيذية"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'المشاريع' },
      ]}
      statusLabel="عرض"
      favoriteHref="/contracting/projects"
      browseList={{
        title: 'المشاريع السابقة',
        apiPath: '/contracting/projects',
        listKey: 'contracting-projects-browse',
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.projectCode || r.id) },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.projectName || '—') },
        ],
        onSelect: (id) => router.push(`/contracting/projects/${id}/technical-office`),
      }}
    >
      <AppTable
        columns={[
          { id: 'code', header: 'الكود', accessor: 'projectCode' },
          { id: 'name', header: 'اسم المشروع', accessor: 'projectName' },
          {
            id: 'customer',
            header: 'العميل',
            cell: (r) => r.customer?.arabicName ?? '—',
          },
          {
            id: 'value',
            header: 'قيمة العقد',
            numeric: true,
            cell: (r) => formatEgp(r.contractValue),
          },
          {
            id: 'open',
            header: '',
            cell: (r) => (
              <Button size="sm" onClick={() => router.push(`/contracting/projects/${r.id}/technical-office`)}>
                فتح المساحة
              </Button>
            ),
          },
        ]}
        data={projects}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        emptyTitle="لا توجد مشاريع"
        emptyDescription="أنشئ مشروعاً من إدارة المشاريع ثم افتح مساحة العمل التنفيذية."
        onRowClick={(r) => router.push(`/contracting/projects/${r.id}/technical-office`)}
        exportFileName="contracting-projects"
      />
    </ExtractsPageChrome>
  );
}
