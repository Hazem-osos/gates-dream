'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import {
  hrEmployeeValueUnitReasonFormSchema,
  type HrEmployeeValueUnitReasonFormInput,
} from '@/lib/validation/hr.schema';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { toast } from '@/lib/feedback/toast';

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

export type HrEmployeeValueReasonFormPageProps = {
  title: string;
  logTag: string;
};

export function HrEmployeeValueReasonFormPage({ title, logTag }: HrEmployeeValueReasonFormPageProps) {
  useBackendReachability();

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
    console.info(logTag, values);
    toast.success('تم الحفظ');
    reset(defaults);
  };

  return (
    <HrPageChrome
      title={title}
      docNumber={watch('serialNumber') || 'جديد'}
      onSave={handleSubmit(onSave)}
      onNew={() => reset(defaults)}
    >
      <FormSectionCard title="بيانات الحركة" bodyClassName="lg:grid-cols-3">
        <CompactFormField label="المسلسل" placeholder="ادخل رقم المسلسل" {...register('serialNumber')} />
        <CompactFormField label="الموظف" error={errors.employee?.message} className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <select className={compactControlClass} {...register('employee')}>
              <option value="">اختر...</option>
              <option value="1212378971212">1212378971212</option>
              <option value="employee1">موظف 1</option>
              <option value="employee2">موظف 2</option>
              <option value="employee3">موظف 3</option>
            </select>
            <input type="text" className={compactControlClass} placeholder="إدخل اسم الموظف" />
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
