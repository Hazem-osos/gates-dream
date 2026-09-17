'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import {
  AppTable,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type MeasurementRow = {
  id: string;
  createdAt: string;
  arabicName: string;
  projectLabel: string;
  unit: string;
  notes: string | null;
};

export default function MaqaysaPage() {
  useBackendReachability();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get('projectId') ?? '';

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const { data: projectsResponse } = useApiQuery<{ id: string; arabicName?: string; serial?: string }[]>(
    ['projects'],
    '/extracts/projects',
    { limit: 1000, isActive: true }
  );
  const projects = projectsResponse?.data ?? [];

  const projectId = useMemo(() => {
    if (paramProjectId) return paramProjectId;
    return projects[0]?.id ?? '';
  }, [paramProjectId, projects]);

  useEffect(() => {
    if (!projects.length) return;
    if (!paramProjectId && projects[0]?.id) {
      const q = new URLSearchParams(searchParams.toString());
      q.set('projectId', projects[0].id);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  }, [projects, paramProjectId, pathname, router, searchParams]);

  const onProjectChange = (id: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (id) q.set('projectId', id);
    else q.delete('projectId');
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  useEffect(() => {
    setPage(1);
  }, [projectId]);

  const { data: defsRes, isLoading } = useApiQuery<
    {
      id: string;
      createdAt: string;
      arabicName: string;
      englishName?: string | null;
      unit?: string | null;
      notes?: string | null;
      project?: { arabicName?: string; serial?: string | null };
    }[]
  >(
    ['extracts-measurement-definitions', projectId, page],
    '/extracts/measurement-definitions',
    { projectId, page, limit: pageSize },
    { enabled: Boolean(projectId) }
  );

  const rows: MeasurementRow[] = (defsRes?.data ?? []).map((d) => ({
    id: d.id,
    createdAt: d.createdAt,
    arabicName: d.arabicName,
    projectLabel: d.project?.arabicName ?? d.project?.serial ?? '—',
    unit: d.unit ?? '—',
    notes: d.notes ?? null,
  }));
  const rowsTotal = defsRes?.pagination?.total ?? defsRes?.meta?.total ?? rows.length;

  return (
    <ExtractsPageChrome
      title="مقايسة المشروع"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/extracts/operations/projects', label: 'إدارة المشاريع' },
        { label: 'مقايسة المشروع' },
      ]}
      statusLabel="عرض"
      favoriteHref="/extracts/operations/projects/maqaysa"
      browseList={{
        title: 'مقايسات المشروع',
        apiPath: '/extracts/measurement-definitions',
        listKey: 'extract-maqaysa-browse',
        extraParams: projectId ? { projectId } : undefined,
        columns: [
          { id: 'name', header: 'البند', getValue: (r) => String(r.arabicName || r.id) },
          { id: 'unit', header: 'الوحدة', getValue: (r) => String(r.unit || '—') },
        ],
        onSelect: () => undefined,
      }}
    >
      <FormSectionCard title="بيانات المقايسة" subtitle="اختر المشروع ثم راجع البنود" icon={ClipboardList}>
        <CompactFormField label="المشروع">
          <select
            id="maqaysa-project"
            value={projectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className={compactControlClass}
          >
            {projects.length === 0 ? (
              <option value="">لا توجد مشاريع</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.arabicName ?? p.serial ?? p.id}
                </option>
              ))
            )}
          </select>
        </CompactFormField>
        <CompactFormField label="الكود" placeholder="00000000001" readOnly />
        <CompactFormField label="الكمية" placeholder="1" />
        <CompactFormField label="القيمة" placeholder="إدخل القيمة" />
      </FormSectionCard>

      <AppTable
        columns={[
          {
            id: 'date',
            header: 'التاريخ',
            cell: (row) =>
              new Date(row.createdAt).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }),
          },
          { id: 'item', header: 'البند الرئيسي', accessor: 'arabicName' },
          { id: 'project', header: 'المشروع', accessor: 'projectLabel' },
          { id: 'unit', header: 'الوحدة', accessor: 'unit' },
          { id: 'notes', header: 'البيان', accessor: 'notes' },
        ]}
        data={rows}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle={!projectId ? 'اختر مشروعاً لعرض تعريفات المقايسة' : 'لا توجد بنود مقايسة لهذا المشروع'}
        exportFileName="project-maqaysa"
        pagination={{
          page,
          pageSize,
          totalItems: rowsTotal,
          onPageChange: setPage,
        }}
      />
    </ExtractsPageChrome>
  );
}
