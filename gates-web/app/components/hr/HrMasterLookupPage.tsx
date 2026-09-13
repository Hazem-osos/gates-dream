'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { HrMasterCodeFields } from '@/components/hr/HrMasterCodeFields';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DataGridDense, DASH_PANEL } from '@/components/dashboard-primitives';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { hrMasterCodeRecordSchema, type HrMasterCodeRecordInput } from '@/lib/validation/hr.schema';
import type { ApiError } from '@/lib/api/types';

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
}) {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<HrMasterCodeRecordInput>({
    resolver: zodResolver(hrMasterCodeRecordSchema) as Resolver<HrMasterCodeRecordInput>,
    defaultValues: empty,
    mode: 'onTouched',
  });

  const key = Array.isArray(queryKey) ? queryKey : [queryKey];
  const { data: listResponse, isFetching, refetch } = useApiQuery<HrLookupRow[]>(
    key,
    listPath,
    { limit: 1000, isActive: true }
  );
  const rows = useMemo(() => {
    const raw = listResponse?.data || [];
    if (rootsOnly) return raw.filter((d) => !d.managementId);
    return filterRows ? filterRows(raw) : raw;
  }, [listResponse?.data, filterRows, rootsOnly]);

  const mutation = useApiMutation<unknown, Record<string, unknown>>(savePath || listPath, 'POST', {
    onSuccess: () => {
      setSuccess(successMessage);
      invalidateQuery(key);
      reset(empty);
      setError('');
    },
    onError: (err: ApiError) => {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const onSave: SubmitHandler<HrMasterCodeRecordInput> = (values) => {
    setError('');
    setSuccess('');
    mutation.mutate({
      code: values.code || undefined,
      arabicName: values.arabicName,
      englishName: values.englishName || undefined,
      ...extraPayload?.(values),
    });
  };

  const onCancel = () => {
    reset(empty);
    setError('');
    setSuccess('');
  };

  return (
    <HrPageChrome
      title={title}
      module="HR / MASTER"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
    >
      <div className="mb-5">
        <DataGridDense
          title="السجلات المعرفة"
          rows={rows}
          empty="لا توجد سجلات بعد"
          columns={[
            { id: 'idx', header: 'م', cell: (row) => rows.findIndex((r) => r.id === row.id) + 1 },
            { id: 'code', header: 'كود', cell: (row) => row.code || '—' },
            { id: 'ar', header: 'الإسم العربي', cell: (row) => row.arabicName || '—' },
            { id: 'en', header: 'الإسم الإنجليزي', cell: (row) => row.englishName || '—' },
          ]}
        />
      </div>

      <div className={`${DASH_PANEL} p-5`}>
        <HrMasterCodeFields register={register} errors={errors} />
        {extraFields}
        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <ActionButtons
            onSave={handleSubmit(onSave)}
            onCancel={onCancel}
            saveText={mutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
          />
        </div>
      </div>
    </HrPageChrome>
  );
}
