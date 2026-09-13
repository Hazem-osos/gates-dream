'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { employeeOnboardingFormSchema, type EmployeeOnboardingFormInput } from '@/lib/validation/hr.schema';

const defaults: EmployeeOnboardingFormInput = {
  serialNumber: '',
  employee: '1212378971212',
  date: '2025-11-26',
  hijriDate: '2025-11-26',
  notes: '',
};

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function EmployeeOnboardingPage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeOnboardingFormInput>({
    resolver: zodResolver(employeeOnboardingFormSchema) as Resolver<EmployeeOnboardingFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<EmployeeOnboardingFormInput> = (values) => {
    console.info('[employee-onboarding]', values);
  };

  return (
    <HrPageChrome title="مباشرة موظف للعمل">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">المسلسل</label>
                    <input type="text" className={inputCls} placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الموظف</label>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <select
                          className="w-50 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                          {...register('employee')}
                        >
                          <option value="">اختر...</option>
                          <option value="1212378971212">1212378971212</option>
                          <option value="employee1">موظف 1</option>
                          <option value="employee2">موظف 2</option>
                          <option value="employee3">موظف 3</option>
                        </select>
                        <input
                          type="text"
                          className="w-50 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                          placeholder="إدخل اسم الموظف"
                        />
                      </div>
                      {errors.employee?.message ? <span className={errCls}>{String(errors.employee.message)}</span> : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">التاريخ</label>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" className={inputCls} {...register('date')} />
                      </div>
                      {errors.date?.message ? <span className={errCls}>{String(errors.date.message)}</span> : null}
                      {errors.hijriDate?.message ? <span className={errCls}>{String(errors.hijriDate.message)}</span> : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">ملاحظات</label>
                    <textarea
                      className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm h-24 resize-none"
                      placeholder="أدخل الملاحظات..."
                      {...register('notes')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-[#D6EAF3]">
              <CrudButtons />
              <ActionButtons onSave={handleSubmit(onSave)} onCancel={() => reset(defaults)} />
            </div>
      </div>
    </HrPageChrome>
  );
}
