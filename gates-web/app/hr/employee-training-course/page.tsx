'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import {
  employeeTrainingCourseFormSchema,
  type EmployeeTrainingCourseFormInput,
} from '@/lib/validation/hr.schema';

const defaults: EmployeeTrainingCourseFormInput = {
  serialNumber: '1212378971212',
  employee: '1212378971212',
  fromDate: '2025-11-26',
  fromDateHijri: '2025-11-26',
  toDate: '2025-11-26',
  toDateHijri: '2025-11-26',
  courseLocation: '',
  courseName: '',
  notes: '',
};

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function EmployeeTrainingCoursePage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeTrainingCourseFormInput>({
    resolver: zodResolver(employeeTrainingCourseFormSchema) as Resolver<EmployeeTrainingCourseFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<EmployeeTrainingCourseFormInput> = (values) => {
    console.info('[employee-training-course]', values);
  };

  return (
    <HrPageChrome title="دورة تدريبية لموظف"
      onSave={handleSubmit(onSave)}
      onNew={() => reset(defaults)}
    >
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#094C6B] mb-2">إسم الدورة</label>
                      <input
                        type="text"
                        className={`${inputCls} ${errors.courseName ? 'border-red-400' : ''}`}
                        placeholder="إدخل إسم الدورة"
                        {...register('courseName')}
                      />
                      {errors.courseName?.message ? <span className={errCls}>{String(errors.courseName.message)}</span> : null}
                    </div>
                    <div>
                      <label className="block text-sm text-[#094C6B] mb-2">مكان الدورة</label>
                      <input
                        type="text"
                        className={`${inputCls} ${errors.courseLocation ? 'border-red-400' : ''}`}
                        placeholder="إدخل مكان الدورة"
                        {...register('courseLocation')}
                      />
                      {errors.courseLocation?.message ? (
                        <span className={errCls}>{String(errors.courseLocation.message)}</span>
                      ) : null}
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

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">من التاريخ</label>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" className={inputCls} {...register('fromDate')} />
                      </div>
                      {errors.fromDate?.message ? <span className={errCls}>{String(errors.fromDate.message)}</span> : null}
                      {errors.fromDateHijri?.message ? (
                        <span className={errCls}>{String(errors.fromDateHijri.message)}</span>
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
                      {errors.toDateHijri?.message ? (
                        <span className={errCls}>{String(errors.toDateHijri.message)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
      </div>
    </HrPageChrome>
  );
}
