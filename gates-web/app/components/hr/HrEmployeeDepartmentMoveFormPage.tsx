'use client';

import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import {
  hrEmployeeDepartmentMoveFormSchema,
  type HrEmployeeDepartmentMoveFormInput,
} from '@/lib/validation/hr.schema';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { applyEmploymentEvent, type HcmEventType } from '@/lib/hr/employment-events';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaults: HrEmployeeDepartmentMoveFormInput = {
  serialNumber: '',
  employee: '',
  date: todayIso(),
  hijriDate: '',
  reason: '',
  toDepartment: '',
  toSection: '',
  notes: '',
};

const EVENT_TYPE: Record<HrEmployeeDepartmentMoveFormPageProps['procedureType'], HcmEventType> = {
  transfer: 'TRANSFER',
  promotion: 'PROMOTION',
  suspension: 'SUSPENSION',
  termination: 'TERMINATION',
};
const MOVES_DEPARTMENT = new Set<HrEmployeeDepartmentMoveFormPageProps['procedureType']>(['transfer', 'promotion']);

type EmployeeRow = { id: string; arabicName?: string; serial?: string | null };
type DepartmentRow = { id: string; arabicName?: string; managementId?: string | null };

export type HrEmployeeDepartmentMoveFormPageProps = {
  title: string;
  procedureType: 'transfer' | 'promotion' | 'suspension' | 'termination';
};

export function HrEmployeeDepartmentMoveFormPage({ title, procedureType }: HrEmployeeDepartmentMoveFormPageProps) {
  useBackendReachability();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: employeesResponse } = useApiQuery<EmployeeRow[]>(
    ['employees'],
    '/hr/employees',
    { limit: 500, isActive: true }
  );
  const { data: departmentsResponse } = useApiQuery<DepartmentRow[]>(
    ['departments'],
    '/hr/departments',
    { limit: 500, isActive: true }
  );
  const employees = employeesResponse?.data ?? [];
  const departments = departmentsResponse?.data ?? [];
  const roots = departments.filter((row) => !row.managementId);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<HrEmployeeDepartmentMoveFormInput>({
    resolver: zodResolver(hrEmployeeDepartmentMoveFormSchema) as Resolver<HrEmployeeDepartmentMoveFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<HrEmployeeDepartmentMoveFormInput> = (values) => {
    setError('');
    setSuccess('');
    setSaving(true);
    const section = departments.find((row) => row.id === values.toSection);
    const management = departments.find((row) => row.id === values.toDepartment);
    const targetDepartmentId = values.toSection || values.toDepartment || undefined;
    const description = `إلى ${management?.arabicName || ''} / ${section?.arabicName || ''}${values.notes ? ` — ${values.notes}` : ''}`;
    // The HCM event changes employment/assignment (and so payroll); the
    // procedure row is kept as the legacy history entry.
    void applyEmploymentEvent({
      employeeId: values.employee,
      eventType: EVENT_TYPE[procedureType],
      effectiveDate: values.date,
      payload: MOVES_DEPARTMENT.has(procedureType) && targetDepartmentId ? { departmentId: targetDepartmentId } : {},
      reason: values.reason,
      notes: values.notes,
    })
      .then(() =>
        apiClient.post('/hr/employee-procedures', {
          employeeId: values.employee,
          serial: values.serialNumber || undefined,
          procedureType,
          date: values.date,
          hijriDate: values.hijriDate || undefined,
          reason: values.reason,
          description,
        })
      )
      .then(() => {
        setSuccess('تم الحفظ وتطبيق الإجراء على بيانات التوظيف');
        reset(defaults);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'تعذر الحفظ');
      })
      .finally(() => setSaving(false));
  };

  return (
    <HrPageChrome
      title={title.trim()}
      docNumber={watch('serialNumber') || 'جديد'}
      onSave={handleSubmit(onSave)}
      onNew={() => reset(defaults)}
      savePending={saving}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <FormSectionCard title="بيانات الموظف" bodyClassName="lg:grid-cols-2">
        <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
        <CompactFormField label="الموظف" error={errors.employee?.message}>
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
          label="السبب"
          placeholder="إدخل السبب"
          error={errors.reason?.message}
          {...register('reason')}
          className="sm:col-span-2"
        />
      </FormSectionCard>

      <FormSectionCard title="الجهة الجديدة" bodyClassName="lg:grid-cols-2">
        <CompactFormField label="إلى الإدارة" error={errors.toDepartment?.message}>
          <div className="flex items-center gap-2">
            <select className={compactControlClass} {...register('toDepartment')}>
              <option value="">اختر الإدارة</option>
              {roots.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.arabicName}
                </option>
              ))}
            </select>
          </div>
        </CompactFormField>
        <CompactFormField label="إلى القسم" error={errors.toSection?.message}>
          <div className="flex items-center gap-2">
            <select className={compactControlClass} {...register('toSection')}>
              <option value="">اختر القسم</option>
              {departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.arabicName}
                </option>
              ))}
            </select>
          </div>
        </CompactFormField>
        <CompactFormField label="ملاحظات" className="sm:col-span-2">
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
