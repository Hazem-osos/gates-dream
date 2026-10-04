'use client';

import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import {
  hrEmployeeValueUnitReasonFormSchema,
  type HrEmployeeValueUnitReasonFormInput,
} from '@/lib/validation/hr.schema';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

const defaults: HrEmployeeValueUnitReasonFormInput = {
  serialNumber: '',
  employee: '',
  date: '2025-11-26',
  hijriDate: '2025-11-26',
  value: '',
  unit: 'جنية',
  reason: '',
  notes: '',
};

type EmployeeRow = { id: string; arabicName?: string; serial?: string | null };

export type HrEmployeeValueReasonFormPageProps = {
  title: string;
  procedureType: 'warning' | 'reward' | 'penalty' | 'other';
};

export function HrEmployeeValueReasonFormPage({ title, procedureType }: HrEmployeeValueReasonFormPageProps) {
  useBackendReachability();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: employeesResponse } = useApiQuery<EmployeeRow[]>(
    ['employees'],
    '/hr/employees',
    { limit: 500, isActive: true }
  );
  const employees = employeesResponse?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<HrEmployeeValueUnitReasonFormInput>({
    resolver: zodResolver(hrEmployeeValueUnitReasonFormSchema) as Resolver<HrEmployeeValueUnitReasonFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<HrEmployeeValueUnitReasonFormInput> = (values) => {
    setError('');
    setSuccess('');
    setSaving(true);
    void apiClient
      .post('/hr/employee-procedures', {
        employeeId: values.employee,
        serial: values.serialNumber || undefined,
        procedureType,
        date: values.date,
        hijriDate: values.hijriDate || undefined,
        amount: Number(values.value) || 0,
        unit: values.unit,
        reason: values.reason,
        description: values.notes || undefined,
      })
      .then(() => {
        setSuccess('تم الحفظ');
        reset(defaults);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'تعذر الحفظ');
      })
      .finally(() => setSaving(false));
  };

  return (
    <HrPageChrome
      title={title}
      docNumber={watch('serialNumber') || 'جديد'}
      onSave={handleSubmit(onSave)}
      onNew={() => reset(defaults)}
      savePending={saving}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <FormSectionCard title="بيانات الحركة" bodyClassName="lg:grid-cols-3">
        <CompactFormField label="المسلسل" placeholder="ادخل رقم المسلسل" {...register('serialNumber')} />
        <CompactFormField label="الموظف" error={errors.employee?.message} className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <select className={compactControlClass} {...register('employee')}>
              <option value="">اختر الموظف</option>
              {employees.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.arabicName || row.serial}
                </option>
              ))}
            </select>
          </div>
        </CompactFormField>
        <CompactFormField label="التاريخ" type="date" error={errors.date?.message} {...register('date')} />
        <CompactFormField
          label="القيمة"
          type="number"
          min="0"
          step="0.01"
          placeholder="إدخل القيمة"
          error={errors.value?.message}
          {...register('value')}
        />
        <CompactFormField label="الوحدة" error={errors.unit?.message}>
          <select className={compactControlClass} {...register('unit')}>
            <option value="جنية">جنية</option>
            <option value="دولار">دولار</option>
            <option value="يورو">يورو</option>
            <option value="نسبة">نسبة</option>
          </select>
        </CompactFormField>
        <CompactFormField
          label="السبب"
          placeholder="إدخل السبب"
          error={errors.reason?.message}
          {...register('reason')}
        />
        <CompactFormField label="ملاحظات" className="sm:col-span-2 lg:col-span-3">
          <textarea
            className={`${compactControlClass} h-24 resize-none`}
            placeholder="أدخل الملاحظات..."
            {...register('notes')}
          />
        </CompactFormField>
      </FormSectionCard>
    </HrPageChrome>
  );
}
