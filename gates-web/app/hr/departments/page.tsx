'use client';

import { useMemo, useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DataGridDense } from '@/components/dashboard-primitives';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { hrDepartmentFormSchema, type HrDepartmentFormInput } from '@/lib/validation/hr.schema';
import type { ApiError } from '@/lib/api/types';
import { confirmAction } from '@/lib/feedback/confirm';

type LookupRow = {
  id: string;
  code?: string;
  arabicName?: string;
  englishName?: string;
  managementId?: string;
};

const empty: HrDepartmentFormInput = { code: '', arabicName: '', englishName: '', managementId: '' };

export default function DepartmentsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<HrDepartmentFormInput>({
    resolver: zodResolver(hrDepartmentFormSchema) as Resolver<HrDepartmentFormInput>,
    defaultValues: empty,
    mode: 'onTouched',
  });

  const { data: listResponse, isFetching, refetch } = useApiQuery<LookupRow[]>(
    ['departments'],
    '/hr/departments',
    { limit: 1000, isActive: true }
  );
  const allRows = listResponse?.data || [];
  const managements = useMemo(
    () => allRows.filter((row) => !row.managementId),
    [allRows]
  );
  const departments = useMemo(
    () => allRows.filter((row) => row.managementId),
    [allRows]
  );

  const createMutation = useApiMutation<unknown, Record<string, unknown>>('/hr/departments', 'POST', {
    onSuccess: () => {
      setSuccess('تم حفظ القسم بنجاح');
      invalidateQuery(['departments']);
      handleNew();
    },
    onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
  });

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/hr/departments/${selectedId}` : '/hr/departments',
    'PUT',
    {
      onSuccess: () => {
        setSuccess('تم تحديث القسم بنجاح');
        invalidateQuery(['departments']);
        setError('');
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const payload = (values: HrDepartmentFormInput) => ({
    code: values.code || undefined,
    arabicName: values.arabicName,
    englishName: values.englishName || undefined,
    managementId: values.managementId || undefined,
  });

  const onSave: SubmitHandler<HrDepartmentFormInput> = (values) => {
    setError('');
    setSuccess('');
    if (selectedId) updateMutation.mutate(payload(values));
    else createMutation.mutate(payload(values));
  };

  const handleNew = () => {
    setSelectedId(null);
    reset(empty);
    setError('');
    setSuccess('');
  };

  const handleSelect = (row: LookupRow) => {
    setSelectedId(row.id);
    reset({
      code: row.code || '',
      arabicName: row.arabicName || '',
      englishName: row.englishName || '',
      managementId: row.managementId || '',
    });
    setError('');
    setSuccess('');
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('حذف هذا القسم نهائياً؟'))) return;
    setDeleting(true);
    setError('');
    try {
      await apiClient.delete(`/hr/departments/${selectedId}`);
      invalidateQuery(['departments']);
      handleNew();
      setSuccess('تم الحذف');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    } finally {
      setDeleting(false);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending || deleting;

  return (
    <HrPageChrome
      onSave={handleSubmit(onSave)}
      onNew={handleNew}
      savePending={saving}
      canSave={!saving}
      title="تعريف الأقسام"
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      docNumber={selectedId ? 'تعديل' : 'جديد'}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      moreMenuItems={
        selectedId
          ? [{ id: 'del', label: 'حذف', onClick: () => void handleDelete(), destructive: true }]
          : undefined
      }
    >
      <div className="mb-4">
        <DataGridDense
          title="الأقسام — اضغط صفاً للتعديل"
          rows={departments}
          loading={isFetching}
          empty="لا توجد أقسام بعد"
          onRowOpen={handleSelect}
          columns={[
            { id: 'code', header: 'كود', cell: (row) => row.code || '—' },
            { id: 'ar', header: 'الإسم العربي', cell: (row) => row.arabicName || '—' },
            { id: 'mgmt', header: 'الإدارة', cell: (row) => managements.find((m) => m.id === row.managementId)?.arabicName || '—' },
          ]}
        />
      </div>

      <FormSectionCard title={selectedId ? 'تعديل القسم' : 'قسم جديد'} className="mb-0 shadow-none">
        <CompactFormField label="الكود" placeholder="إدخل الكود" {...register('code')} />
        <CompactFormField
          label="الإسم العربي"
          placeholder="إدخل الإسم بالعربي"
          error={errors.arabicName?.message}
          {...register('arabicName')}
        />
        <CompactFormField label="الإسم الإنجليزي" placeholder="إدخل الإسم الإنجليزي" {...register('englishName')} />
        <CompactFormField label="الإدارة">
          <select className={compactControlClass} {...register('managementId')}>
            <option value="">اختر الإدارة</option>
            {managements.map((mgmt) => (
              <option key={mgmt.id} value={mgmt.id}>
                {mgmt.arabicName || mgmt.code}
              </option>
            ))}
          </select>
        </CompactFormField>
      </FormSectionCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </HrPageChrome>
  );
}
