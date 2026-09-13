'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { absencePermissionFormSchema, type AbsencePermissionFormInput } from '@/lib/validation/hr.schema';

const defaults: AbsencePermissionFormInput = {
  code: '',
  englishName: '',
  arabicName: '',
  employee: '1212378971212',
  date: '2025-11-26',
  hijriDate: '2025-11-26',
  reason: '',
};

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function AbsencePermissionPage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AbsencePermissionFormInput>({
    resolver: zodResolver(absencePermissionFormSchema) as Resolver<AbsencePermissionFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<AbsencePermissionFormInput> = (values) => {
    console.info('[absence-permission]', values);
  };

  return (
    <HrPageChrome title="إذن غياب">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الكود</label>
                    <input type="text" className={inputCls} placeholder="إدخل رقم الكود" {...register('code')} />
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
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الإسم الإنجليزي</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="إدخل الإسم الإنجليزي"
                      {...register('englishName')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الإسم العربي</label>
                    <input
                      type="text"
                      className={`${inputCls} ${errors.arabicName ? 'border-red-400' : ''}`}
                      placeholder="إدخل الإسم بالعربي"
                      {...register('arabicName')}
                    />
                    {errors.arabicName?.message ? <span className={errCls}>{String(errors.arabicName.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">السبب</label>
                    <input
                      type="text"
                      className={`${inputCls} ${errors.reason ? 'border-red-400' : ''}`}
                      placeholder="إدخل السبب"
                      {...register('reason')}
                    />
                    {errors.reason?.message ? <span className={errCls}>{String(errors.reason.message)}</span> : null}
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
