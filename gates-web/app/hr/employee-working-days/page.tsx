'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import {
  employeeWorkingDaysHeaderSchema,
  type EmployeeWorkingDaysHeaderInput,
} from '@/lib/validation/hr.schema';

interface WorkingDay {
  id: number;
  employeeName: string;
  code: string;
  saturday: boolean;
  sunday: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
}

const headerDefaults: EmployeeWorkingDaysHeaderInput = {
  serialNumber: '',
  englishName: '',
  arabicName: '',
  employee: '1212378971212',
  workBranch: '',
};

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function EmployeeWorkingDaysPage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeWorkingDaysHeaderInput>({
    resolver: zodResolver(employeeWorkingDaysHeaderSchema) as Resolver<EmployeeWorkingDaysHeaderInput>,
    defaultValues: headerDefaults,
    mode: 'onTouched',
  });

  const workingDays: WorkingDay[] = [
    {
      id: 1,
      employeeName: 'إسم الموظف',
      code: 'م',
      saturday: false,
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
    },
    {
      id: 2,
      employeeName: 'إسم الموظف',
      code: '1',
      saturday: false,
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
    },
    {
      id: 3,
      employeeName: 'إسم الموظف',
      code: '2',
      saturday: false,
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
    },
    {
      id: 4,
      employeeName: 'إسم الموظف',
      code: '3',
      saturday: false,
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
    },
    {
      id: 5,
      employeeName: 'إسم الموظف',
      code: '4',
      saturday: false,
      sunday: false,
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
    },
  ];

  const onSaveHeader: SubmitHandler<EmployeeWorkingDaysHeaderInput> = (values) => {
    console.info('[employee-working-days] header', values);
  };

  return (
    <HrPageChrome title="أيام عمل الموطفين"
      onSave={handleSubmit(onSaveHeader)}
      onNew={() => reset(headerDefaults)}
    >
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

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
                      className={inputCls}
                      placeholder="إدخل الإسم بالعربي"
                      {...register('arabicName')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">فرع العمل</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="إدخل فرع العمل"
                      {...register('workBranch')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="overflow-x-auto rounded-lg border border-[#D6EAF3]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="px-4 py-3 text-right font-medium">الكود</th>
                      <th className="px-4 py-3 text-right font-medium">إسم الموظف</th>
                      <th className="px-4 py-3 text-center font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="w-4 h-4 text-white border-white rounded focus:ring-white" />
                          <span>السبت</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="w-4 h-4 text-white border-white rounded focus:ring-white" />
                          <span>الأحد</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="w-4 h-4 text-white border-white rounded focus:ring-white" />
                          <span>الإثنين</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="w-4 h-4 text-white border-white rounded focus:ring-white" />
                          <span>الثلاثاء</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="w-4 h-4 text-white border-white rounded focus:ring-white" />
                          <span>الأربعاء</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="w-4 h-4 text-white border-white rounded focus:ring-white" />
                          <span>الخميس</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <input type="checkbox" className="w-4 h-4 text-white border-white rounded focus:ring-white" />
                          <span>الجمعة</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workingDays.map((day) => (
                      <tr key={day.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">{day.code}</td>
                        <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">{day.employeeName}</td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]" />
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]" />
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]" />
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]" />
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]" />
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]" />
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
      </div>
    </HrPageChrome>
  );
}
