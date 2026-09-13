"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import {
  housingAllowanceEntitlementsDisbursementFormSchema,
  type HousingAllowanceEntitlementsDisbursementFormInput,
} from '@/lib/validation/hr.schema';

const defaults: HousingAllowanceEntitlementsDisbursementFormInput = {
  paymentMethod: 'صندوق',
  serialNumber: '',
  employee: '1212378971212',
  date: '26-11-2025',
  hijriDate: '26-11-2025',
  housingRef: '',
  amount: '',
  notes: '',
  record: '0000012345',
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function HousingAllowanceEntitlementsDisbursementPage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HousingAllowanceEntitlementsDisbursementFormInput>({
    resolver: zodResolver(housingAllowanceEntitlementsDisbursementFormSchema) as Resolver<HousingAllowanceEntitlementsDisbursementFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const paymentMethod = watch('paymentMethod');

  const onSave: SubmitHandler<HousingAllowanceEntitlementsDisbursementFormInput> = (values) => {
    console.info('[housing-allowance-entitlements-disbursement]', values);
  };

  const input = 'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
  const flexInput = 'flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-[#094C6B]';

  return (
    <HrPageChrome title="صرف مستحقات بدل السكن">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4 lg:order-2">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2 font-semibold">طريقة الدفع</label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setValue('paymentMethod', 'بنك', { shouldValidate: true })}
                        className={`px-6 py-3 rounded-lg border-2 transition-all duration-300 transform hover:scale-105 ${
                          paymentMethod === 'بنك'
                            ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg shadow-[#0E79AA]/30 ring-2 ring-[#0E79AA]/20'
                            : 'bg-white text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#F6FBFD] hover:shadow-md'
                        }`}
                      >
                        بنك
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('paymentMethod', 'صندوق', { shouldValidate: true })}
                        className={`px-6 py-3 rounded-lg border-2 transition-all duration-300 transform hover:scale-105 ${
                          paymentMethod === 'صندوق'
                            ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg shadow-[#0E79AA]/30 ring-2 ring-[#0E79AA]/20'
                            : 'bg-white text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#F6FBFD] hover:shadow-md'
                        }`}
                      >
                        صندوق
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">بدل السكن</label>
                    <div className="flex items-center gap-2">
                      <select
                        className="px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] w-40"
                        value={watch('housingRef')}
                        onChange={(e) => setValue('housingRef', e.target.value, { shouldValidate: true })}
                      >
                        <option value="">اختر</option>
                        <option value="صرف شهري">صرف شهري</option>
                        <option value="صرف سنوي">صرف سنوي</option>
                      </select>
                      <input
                        type="text"
                        className={flexInput}
                        placeholder="رقم/مرجع بدل السكن"
                        {...register('housingRef')}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">القيد</label>
                    <button type="button" className="px-4 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                      القيد
                    </button>
                  </div>
                </div>

                <div className="space-y-4 lg:order-1">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">المسلسل</label>
                    <input type="text" className={input} placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الموظف</label>
                    <div className="flex items-center gap-2">
                      <select
                        className={`px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] w-32 ${errors.employee ? 'border-red-400' : ''}`}
                        value={watch('employee')}
                        onChange={(e) => setValue('employee', e.target.value, { shouldValidate: true })}
                      >
                        <option value="">اختر</option>
                        <option value="1212378971212">1212378971212</option>
                      </select>
                      <input
                        type="text"
                        className={`${flexInput} ${errors.employee ? 'border-red-400' : ''}`}
                        placeholder="رقم/اسم الموظف"
                        {...register('employee')}
                      />
                      <svg className="w-5 h-5 text-[#0E79AA] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {errors.employee?.message ? <span className={errCls}>{String(errors.employee.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">التاريخ</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className={`${flexInput} ${errors.date ? 'border-red-400' : ''}`}
                        placeholder="التاريخ"
                        {...register('date')}
                      />
                      <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {errors.date?.message ? <span className={errCls}>{String(errors.date.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">المبلغ</label>
                    <input type="text" className={input} placeholder="المبلغ" {...register('amount')} />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">ملاحظات</label>
                    <textarea
                      rows={4}
                      className={`${input} resize-none`}
                      placeholder="أدخل الملاحظات هنا..."
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
