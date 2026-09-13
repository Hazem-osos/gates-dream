'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { employeeSecondmentFormSchema, type EmployeeSecondmentFormInput } from '@/lib/validation/hr.schema';

const defaults: EmployeeSecondmentFormInput = {
  serialNumber: '1212378971212',
  employee: '1212378971212',
  fromDate: '2025-11-26',
  fromHijriDate: '2025-11-26',
  toDate: '2025-11-26',
  toHijriDate: '2025-11-26',
  placement: '',
  notes: '',
};

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function EmployeeSecondmentPage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeSecondmentFormInput>({
    resolver: zodResolver(employeeSecondmentFormSchema) as Resolver<EmployeeSecondmentFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<EmployeeSecondmentFormInput> = (values) => {
    console.info('[employee-secondment]', values);
  };

  return (
    <HrPageChrome title=" إنتداب لموظف ">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
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
                  <label className="block text-sm text-[#094C6B] mb-2">من التاريخ</label>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="date" className={inputCls} {...register('fromDate')} />
                    </div>
                    {errors.fromDate?.message ? <span className={errCls}>{String(errors.fromDate.message)}</span> : null}
                    {errors.fromHijriDate?.message ? (
                      <span className={errCls}>{String(errors.fromHijriDate.message)}</span>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">الى التاريخ</label>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="date" className={inputCls} {...register('toDate')} />
                    </div>
                    {errors.toDate?.message ? <span className={errCls}>{String(errors.toDate.message)}</span> : null}
                    {errors.toHijriDate?.message ? <span className={errCls}>{String(errors.toHijriDate.message)}</span> : null}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">مكان الإنتداب</label>
                  <input
                    type="text"
                    className={`${inputCls} ${errors.placement ? 'border-red-400' : ''}`}
                    placeholder="أدخل مكان الإنتداب"
                    {...register('placement')}
                  />
                  {errors.placement?.message ? <span className={errCls}>{String(errors.placement.message)}</span> : null}
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

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-[#D6EAF3]">
              <CrudButtons />
              <ActionButtons onSave={handleSubmit(onSave)} onCancel={() => reset(defaults)} />
            </div>
      </div>
    </HrPageChrome>
  );
}
