'use client';

import { useRouter } from 'next/navigation';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatMoneyAr } from '@/lib/formatMoney';

type ExtractRow = {
  id: string;
  extractNumber: string;
  extractType: string;
  status: string;
  extractDate: string;
  currentExecutedAmount: number | string;
  netPayableAmount: number | string;
  project?: { projectCode?: string; projectName?: string };
};

export default function ContractingExtractsListPage() {
  const router = useRouter();
  const { data, isLoading } = useApiQuery<ExtractRow[]>(
    ['contract-extracts'],
    '/contracting/extracts',
    {}
  );
  const rows = data?.data ?? [];

  return (
    <ExtractsPageChrome
      title="مستخلصات العقود"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'مستخلصات العقود' },
      ]}
      onNew={() => router.push('/contracting/extracts/new')}
      statusLabel="عرض"
      favoriteHref="/contracting/extracts"
      browseList={{
        title: 'المستخلصات السابقة',
        apiPath: '/contracting/extracts',
        listKey: 'contract-extracts-browse',
        columns: [
          { id: 'number', header: 'الرقم', getValue: (r) => String(r.extractNumber || r.id) },
          { id: 'project', header: 'المشروع', getValue: (r) => String((r.project as { projectName?: string } | undefined)?.projectName || '—') },
        ],
        onSelect: (id) => router.push(`/contracting/extracts/${id}`),
      }}
    >
      <AppTable
        columns={[
          { id: 'number', header: 'رقم المستخلص', accessor: 'extractNumber' },
          {
            id: 'project',
            header: 'المشروع',
            cell: (r) => `${r.project?.projectCode ?? ''} — ${r.project?.projectName ?? '—'}`,
          },
          {
            id: 'type',
            header: 'النوع',
            cell: (r) => (r.extractType === 'CLIENT' ? 'عميل' : 'مقاول باطن'),
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (r) => new Date(r.extractDate).toLocaleDateString('ar-EG'),
          },
          {
            id: 'current',
            header: 'أعمال الفترة',
            numeric: true,
            cell: (r) => formatMoneyAr(Number(r.currentExecutedAmount) || 0),
          },
          {
            id: 'net',
            header: 'الصافي',
            numeric: true,
            cell: (r) => formatMoneyAr(Number(r.netPayableAmount) || 0),
          },
          { id: 'status', header: 'الحالة', accessor: 'status' },
        ]}
        data={rows}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        emptyTitle="لا توجد مستخلصات"
        emptyDescription="أنشئ مستخلص عميل أو مقاول باطن من «جديد»."
        onRowClick={(r) => router.push(`/contracting/extracts/${r.id}`)}
        exportFileName="contract-extracts"
      />
    </ExtractsPageChrome>
  );
}
