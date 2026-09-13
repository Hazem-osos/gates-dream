'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import {
  housingAllowanceClearanceFormSchema,
  type HousingAllowanceClearanceFormInput,
} from '@/lib/validation/hr.schema';

const defaults: HousingAllowanceClearanceFormInput = {
  serialNumber: '',
  employee: '1212378971212',
  date: '2025-11-26',
  hijriDate: '2025-11-26',
  daysSinceLastDisbursement: '',
  monthsSinceLastDisbursement: '',
  availableAdditions: '',
  monthlySalary: '',
  totalValue: '',
  totalSalary: '',
  notes: '',
  record: '0000012345',
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function HousingAllowanceClearancePage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HousingAllowanceClearanceFormInput>({
    resolver: zodResolver(housingAllowanceClearanceFormSchema) as Resolver<HousingAllowanceClearanceFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<HousingAllowanceClearanceFormInput> = (values) => {
    console.info('[housing-allowance-clearance]', values);
  };

  const inputCls = 'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
  const flex1 = 'flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg';

  return (
    <HrPageChrome title="تصفية مستحقات بدل السكن">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">المسلسل</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className={`${flex1} ${errors.serialNumber ? 'border-red-400' : ''}`}
                        placeholder="إدخل رقم المسلسل"
                        {...register('serialNumber')}
                      />
                      <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الموظف</label>
                    <div className="flex items-center gap-2">
                      <select
                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-sm"
                        value={watch('employee')}
                        onChange={(e) => setValue('employee', e.target.value, { shouldValidate: true })}
                      >
                        <option value="1212378971212">الموظفين</option>
                        <option value="employee1">موظف 1</option>
                        <option value="employee2">موظف 2</option>
                      </select>
                      <input
                        type="text"
                        className={`flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-sm ${errors.employee ? 'border-red-400' : ''}`}
                        placeholder="1212378971212"
                        {...register('employee')}
                      />
                      <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {errors.employee?.message ? <span className={errCls}>{String(errors.employee.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">التاريخ</label>
                    <input
                      type="date"
                      className={`w-full py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg ${errors.date ? 'border-red-400' : ''}`}
                      {...register('date')}
                    />
                    {errors.date?.message ? <span className={errCls}>{String(errors.date.message)}</span> : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">أيام منذ اخر صرف</label>
                    <input type="text" className={inputCls} {...register('daysSinceLastDisbursement')} />
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">شهور منذ اخر صرف</label>
                    <input type="text" className={inputCls} {...register('monthsSinceLastDisbursement')} />
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الإضافات المتاحة</label>
                    <input type="text" className={inputCls} {...register('availableAdditions')} />
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الراتب الشهري</label>
                    <input type="text" className={inputCls} {...register('monthlySalary')} />
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">القيمة الإجمالية</label>
                    <input type="text" className={inputCls} {...register('totalValue')} />
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">إجمالي الراتب</label>
                    <input type="text" className={inputCls} {...register('totalSalary')} />
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">ملاحظات</label>
                    <textarea rows={4} className={inputCls} placeholder="" {...register('notes')} />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#D6EAF3] pt-6">
                <div className="mb-6 flex justify-start items-center gap-5">
                  <button type="button" className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2">
                    القيد
                  </button>
                  <span className="px-4 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B]">{watch('record')}</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex gap-3 items-center">
                    <button type="button" className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                      طباعة
                    </button>
                    <CrudButtons />
                  </div>
                  <ActionButtons onSave={handleSubmit(onSave)} onCancel={() => reset(defaults)} />
                </div>
              </div>
            </div>
      </div>
    </HrPageChrome>
  );
}
