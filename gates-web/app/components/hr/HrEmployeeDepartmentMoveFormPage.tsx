'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CompactFormField,
  FormSectionCard,
  FormStickyFooter,
  compactControlClass,
} from '@/components/ui';
import { CrudButtons } from '@/components/ui/CrudButtons';
import {
  hrEmployeeDepartmentMoveFormSchema,
  type HrEmployeeDepartmentMoveFormInput,
} from '@/lib/validation/hr.schema';
import { HrPageChrome } from '@/components/hr/HrPageChrome';

const defaults: HrEmployeeDepartmentMoveFormInput = {
  serialNumber: '1212378971212',
  employee: '1212378971212',
  date: '2025-11-26',
  hijriDate: '2025-11-26',
  reason: '',
  toDepartment: '1212378971212',
  toSection: '1212378971212',
  notes: '',
};

export type HrEmployeeDepartmentMoveFormPageProps = {
  title: string;
  logTag: string;
};

export function HrEmployeeDepartmentMoveFormPage({ title, logTag }: HrEmployeeDepartmentMoveFormPageProps) {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HrEmployeeDepartmentMoveFormInput>({
    resolver: zodResolver(hrEmployeeDepartmentMoveFormSchema) as Resolver<HrEmployeeDepartmentMoveFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<HrEmployeeDepartmentMoveFormInput> = (values) => {
    console.info(logTag, values);
  };

  return (
    <HrPageChrome title={title} module="HR / MOVEMENTS">
        <FormSectionCard title="بيانات الموظف" bodyClassName="lg:grid-cols-2">
          <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
          <CompactFormField label="الموظف" error={errors.employee?.message}>
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
            label="السبب"
            placeholder="إدخل السبب"
            error={errors.reason?.message}
            {...register('reason')}
            className="sm:col-span-2 lg:col-span-2"
          />
        </FormSectionCard>

        <FormSectionCard title="الجهة الجديدة" bodyClassName="lg:grid-cols-2">
          <CompactFormField label="إلى الإدارة" error={errors.toDepartment?.message}>
            <div className="flex items-center gap-2">
              <select className={compactControlClass} {...register('toDepartment')}>
                <option value="">اختر...</option>
                <option value="1212378971212">1212378971212</option>
                <option value="dept1">إدارة 1</option>
                <option value="dept2">إدارة 2</option>
                <option value="dept3">إدارة 3</option>
              </select>
              <input type="text" className={compactControlClass} placeholder="إدخل الإدارة" />
            </div>
          </CompactFormField>
          <CompactFormField label="إلى القسم" error={errors.toSection?.message}>
            <div className="flex items-center gap-2">
              <select className={compactControlClass} {...register('toSection')}>
                <option value="">اختر...</option>
                <option value="1212378971212">1212378971212</option>
                <option value="section1">قسم 1</option>
                <option value="section2">قسم 2</option>
                <option value="section3">قسم 3</option>
              </select>
              <input type="text" className={compactControlClass} placeholder="إدخل القسم" />
            </div>
          </CompactFormField>
          <CompactFormField label="ملاحظات" className="sm:col-span-2 lg:col-span-2">
            <textarea
              className={`${compactControlClass} h-24 resize-none`}
              placeholder="أدخل الملاحظات..."
              {...register('notes')}
            />
          </CompactFormField>
        </FormSectionCard>

        <FormStickyFooter
          onSave={handleSubmit(onSave)}
          onCancel={() => reset(defaults)}
          extraActions={<CrudButtons />}
        />
    </HrPageChrome>
  );
}
