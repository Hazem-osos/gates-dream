'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrMasterCodeFields } from '@/components/hr/HrMasterCodeFields';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { DataGridDense } from '@/components/dashboard-primitives';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { hrMasterCodeRecordSchema, type HrMasterCodeRecordInput } from '@/lib/validation/hr.schema';
import type { ApiError } from '@/lib/api/types';
import { confirmAction } from '@/lib/feedback/confirm';

export type HrLookupRow = {
  id: string;
  code?: string;
  arabicName?: string;
  englishName?: string;
  managementId?: string;
};

const empty: HrMasterCodeRecordInput = { code: '', arabicName: '', englishName: '' };

export function HrMasterLookupPage({
  title,
  queryKey,
  listPath,
  savePath,
  successMessage,
  filterRows,
  rootsOnly,
  extraFields,
  extraPayload,
  mapRowToForm,
}: {
  title: string;
  queryKey: string | string[];
  listPath: string;
  savePath?: string;
  successMessage: string;
  filterRows?: (rows: HrLookupRow[]) => HrLookupRow[];
  rootsOnly?: boolean;
  extraFields?: ReactNode;
  extraPayload?: (values: HrMasterCodeRecordInput) => Record<string, unknown>;
  mapRowToForm?: (row: HrLookupRow) => HrMasterCodeRecordInput;
}) {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const apiBase = savePath || listPath;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HrMasterCodeRecordInput>({
    resolver: zodResolver(hrMasterCodeRecordSchema) as Resolver<HrMasterCodeRecordInput>,
    defaultValues: empty,
    mode: 'onTouched',
  });

  const key = Array.isArray(queryKey) ? queryKey : [queryKey];
  const { data: listResponse, isFetching } = useApiQuery<HrLookupRow[]>(key, listPath, {
    limit: 1000,
    isActive: true,
  });
  const rows = useMemo(() => {
    const raw = listResponse?.data || [];
    if (rootsOnly) return raw.filter((d) => !d.managementId);
    return filterRows ? filterRows(raw) : raw;
  }, [listResponse?.data, filterRows, rootsOnly]);

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(apiBase, 'POST', {
    onSuccess: () => {
      setSuccess(successMessage);
      invalidateQuery(key);
      handleNew();
    },
    onError: (err: ApiError) => {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `${apiBase}/${selectedId}` : apiBase,
    'PUT',
    {
      onSuccess: () => {
        setSuccess('تم تحديث السجل بنجاح');
        invalidateQuery(key);
        setError('');
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const buildPayload = (values: HrMasterCodeRecordInput) => ({
    code: values.code || undefined,
    arabicName: values.arabicName,
    englishName: values.englishName || undefined,
    ...extraPayload?.(values),
  });

  const onSave: SubmitHandler<HrMasterCodeRecordInput> = (values) => {
    setError('');
    setSuccess('');
    if (selectedId) {
      updateMutation.mutate(buildPayload(values));
      return;
    }
    createMutation.mutate(buildPayload(values));
  };

  const handleNew = () => {
    setSelectedId(null);
    reset(empty);
    setError('');
    setSuccess('');
  };

  const handleSelect = (row: HrLookupRow) => {
    setSelectedId(row.id);
    reset(
      mapRowToForm?.(row) ?? {
        code: row.code || '',
        arabicName: row.arabicName || '',
        englishName: row.englishName || '',
      }
    );
    setError('');
    setSuccess('');
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('حذف هذا التعريف نهائياً؟'))) return;
    setDeleting(true);
    setError('');
    try {
      await apiClient.delete(`${apiBase}/${selectedId}`);
      invalidateQuery(key);
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
      title={title}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      docNumber={selectedId ? 'تعديل' : 'جديد'}
      onSave={handleSubmit(onSave)}
      onNew={handleNew}
      savePending={saving}
      canSave={!saving}
      favoriteHref={listPath.startsWith('/') ? listPath : undefined}
      moreMenuItems={
        selectedId
          ? [
              {
                id: 'del',
                label: 'حذف',
                onClick: () => void handleDelete(),
                destructive: true,
              },
            ]
          : undefined
      }
    >
      <div className="mb-4">
        <DataGridDense
          title="السجلات المعرفة — اضغط صفاً للتعديل"
          rows={rows}
          loading={isFetching}
          empty="لا توجد سجلات بعد"
          onRowOpen={handleSelect}
          columns={[
            { id: 'idx', header: 'م', cell: (row) => rows.findIndex((r) => r.id === row.id) + 1 },
            { id: 'code', header: 'كود', cell: (row) => row.code || '—' },
            { id: 'ar', header: 'الإسم العربي', cell: (row) => row.arabicName || '—' },
            { id: 'en', header: 'الإسم الإنجليزي', cell: (row) => row.englishName || '—' },
          ]}
        />
      </div>

      <FormSectionCard title={selectedId ? 'تعديل التعريف' : 'تعريف جديد'}>
        <div className="col-span-full space-y-3">
          <HrMasterCodeFields register={register} errors={errors} />
          {extraFields}
        </div>
      </FormSectionCard>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </HrPageChrome>
  );
}
