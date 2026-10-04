'use client';

import Link from 'next/link';
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
      title="أرشيف مستخلصات Wave3"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { label: 'أرشيف Wave3' },
      ]}
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
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-bold">مسار Enterprise للمشاريع الجديدة</p>
        <p className="mt-1 text-amber-900">
          المقايسة والحصر والمستخلصات المالية من{' '}
          <Link href="/contracting/projects" className="font-semibold text-[#0E78AA] underline">
            مساحة المشروع
          </Link>{' '}
          (مكتب فني → مستخلصات المالك). مقاول الباطن من{' '}
          <Link href="/subcontracts/contracts" className="font-semibold text-[#0E78AA] underline">
            عقود الباطن
          </Link>
          . هذه الشاشة للاطلاع على مستخلصات Wave3 القديمة فقط — لا تُنشئ مستخلصاً جديداً من هنا.
        </p>
      </div>
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
        emptyTitle="لا توجد مستخلصات Wave3"
        emptyDescription="للمشاريع الجديدة استخدم مساحة المشروع."
        onRowClick={(r) => router.push(`/contracting/extracts/${r.id}`)}
        exportFileName="contract-extracts-archive"
      />
    </ExtractsPageChrome>
  );
}
