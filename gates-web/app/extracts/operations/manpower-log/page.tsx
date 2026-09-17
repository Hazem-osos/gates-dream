'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
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
import { formatMoneyAr } from '@/lib/formatMoney';
import type { ApiError } from '@/lib/api/types';

type ExtractProjectOption = {
  id: string;
  arabicName?: string;
  serial?: string;
};

type ManpowerLogRow = {
  id: string;
  workerName: string;
  workerType?: string | null;
  notes?: string | null;
  total?: number | string | null;
  wage?: number | string | null;
};

export default function ManpowerLogPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [formData, setFormData] = useState({
    serial: '',
    date: '',
    hijriDate: '',
    contractorId: '',
    projectId: '',
    description: '',
  });

  const { data: projectsResponse } = useApiQuery<ExtractProjectOption[]>(
    ['projects'],
    '/extracts/projects',
    { limit: 1000, isActive: true }
  );
  const projects = projectsResponse?.data || [];

  const logQueryParams = useMemo(() => {
    if (!formData.projectId) return undefined;
    return { projectId: formData.projectId, page, limit: pageSize };
  }, [formData.projectId, page, pageSize]);

  const { data: logsResponse, isLoading: logsLoading } = useApiQuery<ManpowerLogRow[]>(
    ['manpower-logs', logQueryParams, page],
    '/extracts/manpower-logs',
    logQueryParams,
    { enabled: !!formData.projectId }
  );
  const logRows = logsResponse?.data ?? [];
  const logsRowsTotal = logsResponse?.pagination?.total ?? logsResponse?.meta?.total ?? logRows.length;

  useEffect(() => {
    setPage(1);
  }, [formData.projectId]);

  const logsTotal = useMemo(() => {
    let sum = 0;
    for (const row of logRows) {
      const raw = row.total ?? row.wage;
      const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
      if (!Number.isNaN(n)) sum += n;
    }
    return sum;
  }, [logRows]);

  const manpowerLogMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/manpower-logs',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ سركي العمالة بنجاح');
        invalidateQuery(['manpower-logs']);
        handleCancel();
      },
      onError: (apiError: ApiError) => {
        setError(apiError.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, date: today, hijriDate: today }));
  }, []);

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.date) {
      setError('يرجى تحديد التاريخ');
      return;
    }

    manpowerLogMutation.mutate({
      serial: formData.serial || undefined,
      date: new Date(formData.date).toISOString(),
      hijriDate: formData.hijriDate || undefined,
      contractorId: formData.contractorId || undefined,
      projectId: formData.projectId || undefined,
    });
  };

  const handleCancel = () => {
    setFormData({
      serial: '',
      date: new Date().toISOString().split('T')[0],
      hijriDate: new Date().toISOString().split('T')[0],
      contractorId: '',
      projectId: '',
      description: '',
    });
    setError('');
    setSuccess('');
  };

  return (
    <ExtractsPageChrome
      title="سجل العمالة"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'سجل العمالة' },
      ]}
      onSave={handleSave}
      savePending={manpowerLogMutation.isPending}
      onNew={handleCancel}
      statusLabel={formData.projectId ? 'تعديل' : 'جديد'}
      favoriteHref="/extracts/operations/manpower-log"
      currentId={formData.projectId || null}
      browseList={{
        title: 'سجلات العمالة السابقة',
        apiPath: '/extracts/manpower-logs',
        listKey: 'extract-manpower-browse',
        columns: [
          { id: 'name', header: 'العامل', getValue: (r) => String(r.workerName || r.id) },
          { id: 'notes', header: 'البيان', getValue: (r) => String(r.notes || '—') },
        ],
        onSelect: (_id, row) => {
          setFormData((prev) => ({
            ...prev,
            description: String(row.notes ?? prev.description),
          }));
        },
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="بيانات السركي" subtitle="التاريخ والمشروع والمقاول" icon={Users}>
        <CompactFormField
          label="الكود"
          placeholder="تلقائي"
          value={formData.serial}
          onChange={(e) => setFormData((p) => ({ ...p, serial: e.target.value }))}
        />
        <CompactFormField
          label="تاريخ السركي"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
        />
        <CompactFormField label="المشروع">
          <select
            className={compactControlClass}
            value={formData.projectId}
            onChange={(e) => setFormData((p) => ({ ...p, projectId: e.target.value }))}
          >
            <option value="">اختر المشروع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.arabicName ?? p.serial ?? p.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="مقاول العمال"
          placeholder="كود المقاول"
          value={formData.contractorId}
          onChange={(e) => setFormData((p) => ({ ...p, contractorId: e.target.value }))}
        />
        <CompactFormField label="الشرح" className="sm:col-span-2">
          <textarea
            placeholder="إدخل الشرح"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            className={`${compactControlClass} h-20 max-w-none resize-none py-2`}
          />
        </CompactFormField>
      </FormSectionCard>

      <AppTable
        columns={[
          { id: 'idx', header: 'م', cell: (_row, index) => index + 1 },
          { id: 'name', header: 'إسم العامل', accessor: 'workerName' },
          { id: 'type', header: 'رقم البطاقة', accessor: 'workerType' },
          { id: 'notes', header: 'بيان الأعمال', accessor: 'notes' },
          {
            id: 'amount',
            header: 'المبلغ',
            numeric: true,
            cell: (row) => {
              const raw = row.total ?? row.wage;
              const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
              return Number.isNaN(n) ? '—' : formatMoneyAr(n);
            },
          },
        ]}
        data={logRows}
        getRowKey={(row) => row.id}
        isLoading={logsLoading}
        emptyTitle={!formData.projectId ? 'اختر المشروع لعرض سجل العمالة.' : 'لا توجد حركات عمالة لهذا المشروع.'}
        exportFileName="manpower-log"
        pagination={{
          page,
          pageSize,
          totalItems: logsRowsTotal,
          onPageChange: setPage,
        }}
      />

      <FormSectionCard title="الإجمالي" className="mt-4">
        <CompactFormField
          label="الإجمالي"
          readOnly
          value={formData.projectId ? formatMoneyAr(logsTotal) : '—'}
        />
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
