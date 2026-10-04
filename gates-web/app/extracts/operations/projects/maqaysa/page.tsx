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
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

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
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [form, setForm] = useState({ arabicName: '', unit: '', notes: '' });

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

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/measurement-definitions',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إنشاء بند المقايسة');
        invalidateQuery(['extracts-measurement-definitions']);
        setForm({ arabicName: '', unit: '', notes: '' });
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إنشاء البند'),
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!projectId) {
      setError('اختر مشروعاً');
      return;
    }
    if (!form.arabicName.trim()) {
      setError('الاسم العربي مطلوب');
      return;
    }
    createMutation.mutate({
      projectId,
      arabicName: form.arabicName.trim(),
      unit: form.unit.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <ExtractsPageChrome
      title="مقايسة المشروع"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/extracts/operations/projects', label: 'إدارة المشاريع' },
        { label: 'مقايسة المشروع' },
      ]}
      onSave={handleSave}
      savePending={createMutation.isPending}
      statusLabel="جديد"
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
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="بيانات المقايسة" subtitle="اختر المشروع ثم أضف بنود المقايسة" icon={ClipboardList}>
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
        <CompactFormField
          label="البند الرئيسي"
          required
          value={form.arabicName}
          onChange={(e) => setForm((p) => ({ ...p, arabicName: e.target.value }))}
        />
        <CompactFormField
          label="الوحدة"
          value={form.unit}
          onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
        />
        <CompactFormField
          label="البيان"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
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
