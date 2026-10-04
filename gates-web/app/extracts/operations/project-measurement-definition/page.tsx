'use client';

import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ClipboardList, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { printPageContent } from '@/lib/print/printHtml';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type MeasurementRow = {
  id: string;
  arabicName: string;
  englishName?: string | null;
  unit?: string | null;
  createdAt: string;
  project?: { arabicName?: string; code?: string };
};

type ProjectOption = { id: string; arabicName?: string; serial?: string };

export default function ProjectMeasurementDefinitionPage() {
  useBackendReachability();
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [form, setForm] = useState({
    projectId: '',
    arabicName: '',
    englishName: '',
    unit: '',
    notes: '',
  });

  const { data: projectsRes } = useApiQuery<ProjectOption[]>(
    ['extracts-projects', 'measurement-create'],
    '/extracts/projects',
    { limit: 500, isActive: true }
  );
  const projects = projectsRes?.data ?? [];

  const { data: defsResponse, isLoading } = useApiQuery<MeasurementRow[]>(
    ['measurement-definitions', page],
    '/extracts/measurement-definitions',
    { page, limit: pageSize }
  );
  const tableData = defsResponse?.data ?? [];
  const tableDataTotal = defsResponse?.pagination?.total ?? defsResponse?.meta?.total ?? tableData.length;

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/measurement-definitions',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إنشاء تعريف المقايسة');
        invalidateQuery(['measurement-definitions']);
        setForm((prev) => ({ ...prev, arabicName: '', englishName: '', unit: '', notes: '' }));
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إنشاء التعريف'),
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!form.projectId) {
      setError('يرجى اختيار المشروع');
      return;
    }
    if (!form.arabicName.trim()) {
      setError('الاسم العربي مطلوب');
      return;
    }
    createMutation.mutate({
      projectId: form.projectId,
      arabicName: form.arabicName.trim(),
      englishName: form.englishName.trim() || undefined,
      unit: form.unit.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <ExtractsPageChrome
      title="تعريف مقايسة المشروع"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'تعريف مقايسة المشروع' },
      ]}
      onSave={handleSave}
      savePending={createMutation.isPending}
      statusLabel="جديد"
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
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="تعريف جديد" subtitle="POST /extracts/measurement-definitions" icon={ClipboardList}>
        <CompactFormField label="المشروع" required>
          <select
            value={form.projectId}
            onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
            className={compactControlClass}
          >
            <option value="">— اختر مشروعاً —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.arabicName || p.serial || p.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="الإسم العربي"
          required
          value={form.arabicName}
          onChange={(e) => setForm((p) => ({ ...p, arabicName: e.target.value }))}
        />
        <CompactFormField
          label="الإسم الإنجليزي"
          value={form.englishName}
          onChange={(e) => setForm((p) => ({ ...p, englishName: e.target.value }))}
        />
        <CompactFormField
          label="الوحدة"
          value={form.unit}
          onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
        />
        <CompactFormField
          label="البيان"
          className="sm:col-span-2"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
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
