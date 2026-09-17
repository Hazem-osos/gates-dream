'use client';

import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ClipboardList, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { printPageContent } from '@/lib/print/printHtml';

type MeasurementRow = {
  id: string;
  arabicName: string;
  englishName?: string | null;
  unit?: string | null;
  createdAt: string;
  project?: { arabicName?: string; code?: string };
};

export default function ProjectMeasurementDefinitionPage() {
  useBackendReachability();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const { data: defsResponse, isLoading } = useApiQuery<MeasurementRow[]>(
    ['measurement-definitions', page],
    '/extracts/measurement-definitions',
    { page, limit: pageSize }
  );
  const tableData = defsResponse?.data ?? [];
  const tableDataTotal = defsResponse?.pagination?.total ?? defsResponse?.meta?.total ?? tableData.length;

  return (
    <ExtractsPageChrome
      title="تعريف مقايسة المشروع"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'تعريف مقايسة المشروع' },
      ]}
      onSave={() => undefined}
      canSave={false}
      statusLabel="عرض"
      favoriteHref="/extracts/operations/project-measurement-definition"
      browseList={{
        title: 'تعريفات المقايسة',
        apiPath: '/extracts/measurement-definitions',
        listKey: 'extract-measurement-browse',
        columns: [
          { id: 'name', header: 'البند', getValue: (r) => String(r.arabicName || r.id) },
          { id: 'project', header: 'المشروع', getValue: (r) => String((r.project as { arabicName?: string } | undefined)?.arabicName || '—') },
        ],
        onSelect: () => undefined,
      }}
      extraActions={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => void printPageContent('تعريف مقايسة المشروع')}
        >
          <Printer className="h-3.5 w-3.5" />
          طباعة
        </Button>
      }
    >
      <FormSectionCard title="البيانات الأساسية" subtitle="كود البند والكمية والقيمة" icon={ClipboardList}>
        <CompactFormField label="الكود" defaultValue="000000000001" readOnly />
        <CompactFormField label="الكمية" defaultValue="1" />
        <CompactFormField label="القيمة" placeholder="إدخل القيمة" />
      </FormSectionCard>

      <AppTable
        columns={[
          {
            id: 'date',
            header: 'التاريخ',
            cell: (row) => new Date(row.createdAt).toLocaleDateString('ar-EG'),
          },
          { id: 'item', header: 'البند الرئيسي', accessor: 'arabicName' },
          {
            id: 'project',
            header: 'المشروع',
            cell: (row) => row.project?.arabicName ?? '—',
          },
          { id: 'unit', header: 'الوحدة', accessor: 'unit' },
          {
            id: 'notes',
            header: 'البيان',
            cell: (row) => row.englishName ?? row.arabicName,
          },
        ]}
        data={tableData}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="لا توجد مقايسات"
        emptyDescription="أضف تعريفات مقايسة للمشروع."
        exportFileName="measurement-definitions"
        pagination={{
          page,
          pageSize,
          totalItems: tableDataTotal,
          onPageChange: setPage,
        }}
      />
    </ExtractsPageChrome>
  );
}
