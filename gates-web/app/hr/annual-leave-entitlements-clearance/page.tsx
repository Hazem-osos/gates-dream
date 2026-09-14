'use client';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import {
  annualLeaveEntitlementsClearanceFormSchema,
  type AnnualLeaveEntitlementsClearanceFormInput,
} from '@/lib/validation/hr.schema';
import { printPageContent } from '@/lib/print/printHtml';

type EmployeePreset = 'employee' | 'employee1' | 'employee2';

const EMPLOYEE_BY_PRESET: Record<EmployeePreset, string> = {
  employee: '1212378971212',
  employee1: 'موظف 1',
  employee2: 'موظف 2',
};

const defaultFormValues: AnnualLeaveEntitlementsClearanceFormInput = {
  serialNumber: '',
  employee: '1212378971212',
  date: '2025-11-26',
  hijriDate: '2025-11-26',
  fromDate: '2025-11-26',
  fromDateHijri: '2025-11-26',
  toDate: '2025-11-26',
  toDateHijri: '2025-11-26',
  lastDirectDate: '2025-11-26',
  lastDirectDateHijri: '2025-11-26',
  workDays: '',
  dueDays: '',
  previousBalance: '',
  totalAvailableDays: '',
  monthlySalary: '',
  availableAllowances: '',
  totalValue: '',
  dueTickets: '',
  addedValue: '',
  requiredDays: '',
  deductedValue: '',
  leaveEntitlements: '',
  totalEntitlements: '',
  notes: '',
  record: '0000012345',
};

export default function AnnualLeaveEntitlementsClearancePage() {
  useBackendReachability();

  const defaults = useMemo(() => ({ ...defaultFormValues }), []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AnnualLeaveEntitlementsClearanceFormInput>({
    resolver: zodResolver(annualLeaveEntitlementsClearanceFormSchema),
    defaultValues: defaults,
  });

  const employeeWatched = watch('employee');
  const employeePreset: EmployeePreset =
    employeeWatched === EMPLOYEE_BY_PRESET.employee1
      ? 'employee1'
      : employeeWatched === EMPLOYEE_BY_PRESET.employee2
        ? 'employee2'
        : 'employee';

  const inputCls =
    'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
  const dateCls = (name: keyof AnnualLeaveEntitlementsClearanceFormInput) =>
    `py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${
      errors[name] ? 'border-red-400' : ''
    }`;

  const onSave = (data: AnnualLeaveEntitlementsClearanceFormInput) => {
    console.info('annual-leave-entitlements-clearance', data);
  };

  return (
    <HrPageChrome title="تصفية مستحقات الأجازة السنوية">
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
                        {...register('serialNumber')}
                        className={`flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${
                          errors.serialNumber ? 'border-red-400' : ''
                        }`}
                        placeholder="إدخل رقم المسلسل"
                      />
                      <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    {errors.serialNumber && (
                      <p className="text-xs text-red-600 mt-1">{errors.serialNumber.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الموظف</label>
                    <div className="flex items-center gap-2">
                      <select
                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-sm"
                        value={employeePreset}
                        onChange={(e) => {
                          const v = e.target.value as EmployeePreset;
                          setValue('employee', EMPLOYEE_BY_PRESET[v], { shouldValidate: true, shouldDirty: true });
                        }}
                        aria-label="اختيار نموذج موظف"
                      >
                        <option value="employee">الموظف</option>
                        <option value="employee1">موظف 1</option>
                        <option value="employee2">موظف 2</option>
                      </select>
                      <input
                        type="text"
                        {...register('employee')}
                        className={`flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-sm ${
                          errors.employee ? 'border-red-400' : ''
                        }`}
                        placeholder="1212378971212"
                      />
                      <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    {errors.employee && <p className="text-xs text-red-600 mt-1">{errors.employee.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">التاريخ</label>
                    <input type="date" {...register('date')} className={dateCls('date')} />
                    {errors.date && (
                      <p className="text-xs text-red-600 mt-1">{errors.date.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">من تاريخ</label>
                    <input type="date" {...register('fromDate')} className={dateCls('fromDate')} />
                    {errors.fromDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.fromDate.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">إلى تاريخ</label>
                    <input type="date" {...register('toDate')} className={dateCls('toDate')} />
                    {errors.toDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.toDate.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">تاريخ أخر مباشرة</label>
                    <input type="date" {...register('lastDirectDate')} className={dateCls('lastDirectDate')} />
                    {errors.lastDirectDate && (
                      <p className="text-xs text-red-600 mt-1">{errors.lastDirectDate.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {(
                    [
                      ['workDays', 'أيام العمل', 'إدخل أيام العمل'],
                      ['dueDays', 'الأيام المستحقة', 'إدخل الأيام المستحقة'],
                      ['previousBalance', 'الرصيد السابق', undefined],
                      ['totalAvailableDays', 'إجمالي الأيام المتاحة', undefined],
                      ['monthlySalary', 'الراتب الشهري', undefined],
                      ['availableAllowances', 'البدلات المتاحة', undefined],
                      ['requiredDays', 'الأيام المطلوبة', undefined],
                      ['leaveEntitlements', 'مستحقات الأجازة', undefined],
                      ['totalEntitlements', 'إجمالى المستحقات', undefined],
                    ] as const
                  ).map(([name, label, placeholder]) => (
                    <div key={name}>
                      <label className="block text-sm text-[#094C6B] mb-2">{label}</label>
                      <input
                        type="text"
                        {...register(name)}
                        className={`${inputCls} ${errors[name] ? 'border-red-400' : ''}`}
                        placeholder={placeholder}
                      />
                      {errors[name] && (
                        <p className="text-xs text-red-600 mt-1">{errors[name]?.message as string}</p>
                      )}
                    </div>
                  ))}

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">ملاحظات</label>
                    <textarea
                      {...register('notes')}
                      rows={4}
                      className={`${inputCls} ${errors.notes ? 'border-red-400' : ''}`}
                      placeholder="أدخل الملاحظات هنا..."
                    />
                    {errors.notes && <p className="text-xs text-red-600 mt-1">{errors.notes.message}</p>}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-[#D6EAF3] p-4">
                <h3 className="text-md font-semibold text-[#094C6B] mb-4 text-center">ملخص التذاكر</h3>

                <div className="mb-4">
                  <label className="block text-sm text-[#094C6B] mb-2">تذكرة كاملة</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="0"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                    <input
                      type="text"
                      placeholder="0.00"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                    <input
                      type="text"
                      placeholder="0.00"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500 text-center">
                    <span>العدد</span>
                    <span>السعر</span>
                    <span>الإجمالي</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-[#094C6B] mb-2">نصف تذكرة</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="0"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                    <input
                      type="text"
                      placeholder="0.00"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                    <input
                      type="text"
                      placeholder="0.00"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500 text-center">
                    <span>العدد</span>
                    <span>السعر</span>
                    <span>الإجمالي</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-[#094C6B] mb-2">تذكرة رضع</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="0"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                    <input
                      type="text"
                      placeholder="0.00"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                    <input
                      type="text"
                      placeholder="0.00"
                      className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500 text-center">
                    <span>العدد</span>
                    <span>السعر</span>
                    <span>الإجمالي</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="w-40 text-right text-sm text-[#094C6B]">إجمالي القيمة:</label>
                    <input
                      type="text"
                      placeholder="0.00"
                      className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-40 text-right text-sm text-[#094C6B]">التذاكر المستحقة:</label>
                    <input
                      type="text"
                      placeholder="0.00"
                      className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-40 text-right text-sm text-[#094C6B]">قيمة مضافة:</label>
                    <input
                      type="text"
                      placeholder="0.00"
                      className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-40 text-right text-sm text-[#094C6B]">قيمة مستقطعة:</label>
                    <input
                      type="text"
                      placeholder="0.00"
                      className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#D6EAF3] pt-6">
              <div className="mb-6 flex justify-start items-center gap-5">
                <button
                  type="button"
                  className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2"
                >
                  القيد
                </button>
                <input
                  type="text"
                  {...register('record')}
                  className={`ml-10 px-4 py-2 border border-[#D6EAF3] bg-[#F6FBFD] hover:bg-[#E6F3F8] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-[#094C6B] transition-colors w-40 ${
                    errors.record ? 'border-red-400' : ''
                  }`}
                />
                {errors.record && <span className="text-xs text-red-600">{errors.record.message}</span>}
              </div>

              <div className="flex justify-between items-center">
                <div className="flex gap-3 items-center">
                  <button
                    type="button"
                    className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2"
                    onClick={() => void printPageContent('تصفية مستحقات الأجازة السنوية')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    طباعة
                  </button>
                  <CrudButtons />
                </div>
                <ActionButtons onSave={handleSubmit(onSave)} onCancel={() => reset(defaults)} />
              </div>
            </div>
      </div>
    </HrPageChrome>
  );
}
