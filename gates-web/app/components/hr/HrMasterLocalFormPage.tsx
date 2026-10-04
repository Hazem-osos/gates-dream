'use client';

import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrMasterCodeFields } from '@/components/hr/HrMasterCodeFields';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import SuccessToast from '@/components/SuccessToast';
import ErrorToast from '@/components/ErrorToast';
import { hrMasterCodeRecordSchema, type HrMasterCodeRecordInput } from '@/lib/validation/hr.schema';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';

const empty: HrMasterCodeRecordInput = { code: '', arabicName: '', englishName: '' };

type LookupRow = { id: string; code?: string | null; arabicName: string; englishName?: string | null };

export function HrMasterLocalFormPage({
  title,
  kind,
  cardTitle = 'بيانات أساسية',
}: {
  title: string;
  kind: 'qualification' | 'document_type' | 'ticket' | 'specialization' | 'procedure';
  cardTitle?: string;
}) {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const { data: list } = useApiQuery<LookupRow[]>(['hr-lookups', kind], '/hr/lookups', { kind });

  const save = useApiMutation<LookupRow, Record<string, unknown>>(
    selectedId ? `/hr/lookups/${selectedId}` : '/hr/lookups',
    selectedId ? 'PUT' : 'POST',
    {
      onSuccess: (res) => {
        setSuccess('تم الحفظ');
        setError('');
        invalidateQuery(['hr-lookups', kind]);
        if (res.data?.id) setSelectedId(res.data.id);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر الحفظ'),
    }
  );

  const onSave: SubmitHandler<HrMasterCodeRecordInput> = (values) => {
    setError('');
    setSuccess('');
    save.mutate({
      kind,
      code: values.code || null,
      arabicName: values.arabicName,
      englishName: values.englishName || null,
    });
  };

  const onNew = () => {
    setSelectedId(null);
    reset(empty);
    setSuccess('');
    setError('');
  };

  return (
    <HrPageChrome title={title} statusLabel="تعريف" onSave={handleSubmit(onSave)} onNew={onNew} savePending={save.isPending}>
      <FormSectionCard title={cardTitle}>
        <div className="col-span-full space-y-3">
          <HrMasterCodeFields register={register} errors={errors} />
          {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
          {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
          <ul className="divide-y text-sm">
            {(list?.data ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full justify-between py-2 text-right"
                  onClick={() => {
                    setSelectedId(row.id);
                    reset({
                      code: row.code ?? '',
                      arabicName: row.arabicName,
                      englishName: row.englishName ?? '',
                    });
                  }}
                >
                  <span>{row.arabicName}</span>
                  <span className="text-slate-500">{row.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </FormSectionCard>
    </HrPageChrome>
  );
}
