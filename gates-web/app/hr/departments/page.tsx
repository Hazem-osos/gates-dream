'use client';

import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { hrDepartmentFormSchema, type HrDepartmentFormInput } from '@/lib/validation/hr.schema';
import type { ApiError } from '@/lib/api/types';

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
  const { register, handleSubmit, reset, formState: { errors } } = useForm<HrDepartmentFormInput>({
    resolver: zodResolver(hrDepartmentFormSchema) as Resolver<HrDepartmentFormInput>,
    defaultValues: empty,
    mode: 'onTouched',
  });

  const { data: managementsResponse, isFetching, refetch } = useApiQuery<LookupRow[]>(
    ['managements'],
    '/hr/managements',
    { limit: 1000, isActive: true }
  );
  const managements = managementsResponse?.data || [];

  const departmentMutation = useApiMutation<unknown, Record<string, unknown>>('/hr/departments', 'POST', {
    onSuccess: () => {
      setSuccess('تم حفظ القسم بنجاح');
      invalidateQuery(['departments']);
      reset(empty);
      setError('');
    },
    onError: (err: ApiError) => {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const onSave: SubmitHandler<HrDepartmentFormInput> = (values) => {
    setError('');
    setSuccess('');
    departmentMutation.mutate({
      code: values.code || undefined,
      arabicName: values.arabicName,
      englishName: values.englishName || undefined,
      managementId: values.managementId || undefined,
    });
  };

  const onCancel = () => {
    reset(empty);
    setError('');
    setSuccess('');
  };

  return (
    <HrPageChrome
      onSave={handleSubmit(onSave)}
      onNew={onCancel}
      savePending={departmentMutation.isPending}
      title="تعريف الأقسام"
      module="HR / MASTER"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
    >
      <div className={`${DASH_PANEL} p-5`}>
        <FormSectionCard title="بيانات القسم" className="mb-0 shadow-none">
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
      </div>
    </HrPageChrome>
  );
}
