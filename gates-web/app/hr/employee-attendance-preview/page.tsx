'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import {
  employeeAttendancePreviewFilterSchema,
  type EmployeeAttendancePreviewFilterInput,
} from '@/lib/validation/hr.schema';

const filterDefaults: EmployeeAttendancePreviewFilterInput = {
  year: '2025',
  month: 'يناير',
  employee: '1212378971212',
};

const filterErrCls = 'text-red-600 text-xs mt-1 block text-right';

interface EmployeeAttendance {
  id: number;
  employeeId: string;
  employeeName: string;
  date: string;
  attendance: string;
  departure: string;
  status: string;
  workStart: string;
  workEnd: string;
  absenceDays: string;
  overtimeHours: string;
  overtimeDays: string;
  delayHours: string;
}

export default function EmployeeAttendancePreviewPage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeAttendancePreviewFilterInput>({
    resolver: zodResolver(employeeAttendancePreviewFilterSchema) as Resolver<EmployeeAttendancePreviewFilterInput>,
    defaultValues: filterDefaults,
    mode: 'onTouched',
  });

  const onShowData: SubmitHandler<EmployeeAttendancePreviewFilterInput> = (values) => {
    console.info('[employee-attendance-preview] filters', values);
  };

  const [attendanceData] = useState<EmployeeAttendance[]>([
    {
      id: 1,
      employeeId: '',
      employeeName: '',
      date: '',
      attendance: '',
      departure: '',
      status: '',
      workStart: '',
      workEnd: '',
      absenceDays: '',
      overtimeHours: '',
      overtimeDays: '',
      delayHours: ''
    },
    {
      id: 2,
      employeeId: '',
      employeeName: '',
      date: '',
      attendance: '',
      departure: '',
      status: '',
      workStart: '',
      workEnd: '',
      absenceDays: '',
      overtimeHours: '',
      overtimeDays: '',
      delayHours: ''
    },
    {
      id: 3,
      employeeId: '',
      employeeName: '',
      date: '',
      attendance: '',
      departure: '',
      status: '',
      workStart: '',
      workEnd: '',
      absenceDays: '',
      overtimeHours: '',
      overtimeDays: '',
      delayHours: ''
    },
    {
      id: 4,
      employeeId: '',
      employeeName: '',
      date: '',
      attendance: '',
      departure: '',
      status: '',
      workStart: '',
      workEnd: '',
      absenceDays: '',
      overtimeHours: '',
      overtimeDays: '',
      delayHours: ''
    },
    {
      id: 5,
      employeeId: '',
      employeeName: '',
      date: '',
      attendance: '',
      departure: '',
      status: '',
      workStart: '',
      workEnd: '',
      absenceDays: '',
      overtimeHours: '',
      overtimeDays: '',
      delayHours: ''
    },
    {
      id: 6,
      employeeId: '',
      employeeName: '',
      date: '',
      attendance: '',
      departure: '',
      status: '',
      workStart: '',
      workEnd: '',
      absenceDays: '',
      overtimeHours: '',
      overtimeDays: '',
      delayHours: ''
    },
    {
      id: 7,
      employeeId: '',
      employeeName: '',
      date: '',
      attendance: '',
      departure: '',
      status: '',
      workStart: '',
      workEnd: '',
      absenceDays: '',
      overtimeHours: '',
      overtimeDays: '',
      delayHours: ''
    }
  ]);

  const inputCls = "h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  return (
    <HrPageChrome title="معاينة حضور وانصراف موظف"
      onSave={handleSubmit(onShowData)}
      onNew={() => reset(filterDefaults)}
    >
      <div className={`${DASH_PANEL} p-5`}>
            {/* Filters Section */}
            <div className="mb-8 space-y-6">
              {/* Section Title */}
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">السنة</label>
                  <input
                    type="text"
                    className={`${inputCls} ${errors.year ? 'border-red-400' : ''}`}
                    {...register('year')}
                  />
                  {errors.year?.message ? <span className={filterErrCls}>{String(errors.year.message)}</span> : null}
                </div>

                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">الشهر</label>
                  <select className={`${inputCls} ${errors.month ? 'border-red-400' : ''}`} {...register('month')}>
                    <option value="يناير">يناير</option>
                    <option value="فبراير">فبراير</option>
                    <option value="مارس">مارس</option>
                    <option value="أبريل">أبريل</option>
                    <option value="مايو">مايو</option>
                    <option value="يونيو">يونيو</option>
                    <option value="يوليو">يوليو</option>
                    <option value="أغسطس">أغسطس</option>
                    <option value="سبتمبر">سبتمبر</option>
                    <option value="أكتوبر">أكتوبر</option>
                    <option value="نوفمبر">نوفمبر</option>
                    <option value="ديسمبر">ديسمبر</option>
                  </select>
                  {errors.month?.message ? <span className={filterErrCls}>{String(errors.month.message)}</span> : null}
                </div>

                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">الموظف</label>
                  <input
                    type="text"
                    className={`${inputCls} ${errors.employee ? 'border-red-400' : ''}`}
                    {...register('employee')}
                  />
                  {errors.employee?.message ? <span className={filterErrCls}>{String(errors.employee.message)}</span> : null}
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleSubmit(onShowData)}
                  className="px-8 py-3 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors"
                >
                  عرض البيانات
                </button>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="mb-8">
              {/* Scroll Hint */}
              <div className="text-center mb-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  <span>اسحب للجانب لعرض جميع الأعمدة</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-lg border border-[#D6EAF3] scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-50">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="px-4 py-3 text-center font-medium">م</th>
                      <th className="px-4 py-3 text-right font-medium">رقم الموظف</th>
                      <th className="px-4 py-3 text-right font-medium">إسم الموظف</th>
                      <th className="px-4 py-3 text-center font-medium">التاريخ</th>
                      <th className="px-4 py-3 text-center font-medium">حضور</th>
                      <th className="px-4 py-3 text-center font-medium">إنصراف</th>
                      <th className="px-4 py-3 text-center font-medium">الحالة</th>
                      <th className="px-4 py-3 text-center font-medium">بداية العمل</th>
                      <th className="px-4 py-3 text-center font-medium">نهاية العمل</th>
                      <th className="px-4 py-3 text-center font-medium">أيام غياب</th>
                      <th className="px-4 py-3 text-center font-medium">قيمتها</th>
                      <th className="px-4 py-3 text-center font-medium">تحسب</th>
                      <th className="px-4 py-3 text-center font-medium">ساعات تأخير</th>
                      <th className="px-4 py-3 text-center font-medium">قيمتها</th>
                      <th className="px-4 py-3 text-center font-medium">تحسب</th>
                      <th className="px-4 py-3 text-center font-medium">أيام إضافي</th>
                      <th className="px-4 py-3 text-center font-medium">قيمتها</th>
                      <th className="px-4 py-3 text-center font-medium">تحسب</th>
                      <th className="px-4 py-3 text-center font-medium">ساعات إضافي</th>
                      <th className="px-4 py-3 text-center font-medium">قيمتها</th>
                      <th className="px-4 py-3 text-center font-medium">تحسب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{item.id}</td>
                        <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">
                          <div className="text-sm">-</div>
                        </td>
                        <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">
                          <div className="text-sm">-</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">-</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">-</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">-</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">-</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">-</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">-</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="space-y-1">
                            <div className="text-sm">-</div>
                            <div className="text-xs">
                              <button className="text-[#0E79AA] hover:underline">تحسب</button>
                            </div>
                          </div>
                        </td>
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
