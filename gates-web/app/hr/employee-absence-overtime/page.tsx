'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import {
  employeeAbsenceOvertimeHeaderSchema,
  type EmployeeAbsenceOvertimeHeaderInput,
} from '@/lib/validation/hr.schema';

const absenceOvertimeDefaults: EmployeeAbsenceOvertimeHeaderInput = {
  serialNumber: '1212378971212',
  department: '',
  section: '',
  jobCadre: '',
  jobTitle: '',
  city: '',
  wagePolicy: '',
  salaryBranch: '',
  costCenter: '',
  arabicDescription: 'إدخل الجامعة',
  englishDescription: 'إدخل الجامعة',
  date: '2025-11-26',
  hijriDate: '2025-11-26',
  year: '2025',
  month: 'يناير',
};

const headerErrCls = 'text-red-600 text-xs mt-1 block text-right';

interface EmployeeAbsenceOvertime {
  id: number;
  employeeId: string;
  employeeName: string;
  delayHours: string;
  delayValue: string;
  absenceDays: string;
  absenceValue: string;
  overtimeDays: string;
  overtimeValue: string;
  totalAbsence: string;
  totalNet: string;
  net: string;
}

export default function EmployeeAbsenceOvertimePage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeAbsenceOvertimeHeaderInput>({
    resolver: zodResolver(employeeAbsenceOvertimeHeaderSchema) as Resolver<EmployeeAbsenceOvertimeHeaderInput>,
    defaultValues: absenceOvertimeDefaults,
    mode: 'onTouched',
  });

  const onSaveHeader: SubmitHandler<EmployeeAbsenceOvertimeHeaderInput> = (values) => {
    console.info('[employee-absence-overtime] header', values);
  };

  const [absenceData] = useState<EmployeeAbsenceOvertime[]>([
    {
      id: 1,
      employeeId: 'رقم الموظف',
      employeeName: 'إسم الموظف',
      delayHours: 'ساعات التأخير',
      delayValue: '',
      absenceDays: 'أيام الغياب',
      absenceValue: '',
      overtimeDays: 'أيام الإضافي',
      overtimeValue: '',
      totalAbsence: 'إجمالي الغياب',
      totalNet: 'إجمالي الصافي',
      net: 'الصافي'
    },
    {
      id: 2,
      employeeId: 'رقم الموظف',
      employeeName: 'إسم الموظف',
      delayHours: 'ساعات التأخير',
      delayValue: '',
      absenceDays: 'أيام الغياب',
      absenceValue: '',
      overtimeDays: 'أيام الإضافي',
      overtimeValue: '',
      totalAbsence: 'إجمالي الغياب',
      totalNet: 'إجمالي الصافي',
      net: 'الصافي'
    },
    {
      id: 3,
      employeeId: 'رقم الموظف',
      employeeName: 'إسم الموظف',
      delayHours: 'ساعات التأخير',
      delayValue: '',
      absenceDays: 'أيام الغياب',
      absenceValue: '',
      overtimeDays: 'أيام الإضافي',
      overtimeValue: '',
      totalAbsence: 'إجمالي الغياب',
      totalNet: 'إجمالي الصافي',
      net: 'الصافي'
    },
    {
      id: 4,
      employeeId: 'رقم الموظف',
      employeeName: 'إسم الموظف',
      delayHours: 'ساعات التأخير',
      delayValue: '',
      absenceDays: 'أيام الغياب',
      absenceValue: '',
      overtimeDays: 'أيام الإضافي',
      overtimeValue: '',
      totalAbsence: 'إجمالي الغياب',
      totalNet: 'إجمالي الصافي',
      net: 'الصافي'
    },
    {
      id: 5,
      employeeId: 'رقم الموظف',
      employeeName: 'إسم الموظف',
      delayHours: 'ساعات التأخير',
      delayValue: '',
      absenceDays: 'أيام الغياب',
      absenceValue: '',
      overtimeDays: 'أيام الإضافي',
      overtimeValue: '',
      totalAbsence: 'إجمالي الغياب',
      totalNet: 'إجمالي الصافي',
      net: 'الصافي'
    },
    {
      id: 6,
      employeeId: 'رقم الموظف',
      employeeName: 'إسم الموظف',
      delayHours: 'ساعات التأخير',
      delayValue: '',
      absenceDays: 'أيام الغياب',
      absenceValue: '',
      overtimeDays: 'أيام الإضافي',
      overtimeValue: '',
      totalAbsence: 'إجمالي الغياب',
      totalNet: 'إجمالي الصافي',
      net: 'الصافي'
    },
    {
      id: 7,
      employeeId: 'رقم الموظف',
      employeeName: 'إسم الموظف',
      delayHours: 'ساعات التأخير',
      delayValue: '',
      absenceDays: 'أيام الغياب',
      absenceValue: '',
      overtimeDays: 'أيام الإضافي',
      overtimeValue: '',
      totalAbsence: 'إجمالي الغياب',
      totalNet: 'إجمالي الصافي',
      net: 'الصافي'
    }
  ]);

  const inputCls = "h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";
  const flexInputCls =
    'flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg';

  return (
    <HrPageChrome title="غياب الموظفين والإضافي">
      <div className={`${DASH_PANEL} p-5`}>
            {/* Form Section */}
            <div className="mb-8 space-y-6">
              {/* Section Title */}
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Right Column (Now Left) */}
                <div className="space-y-4">
                  {/* Serial Number */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">المسلسل</label>
                    <input type="text" className={`${inputCls} ${errors.serialNumber ? 'border-red-400' : ''}`} {...register('serialNumber')} />
                    {errors.serialNumber?.message ? <span className={headerErrCls}>{String(errors.serialNumber.message)}</span> : null}
                  </div>

                  {/* Arabic Description */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">وصف عربي</label>
                    <input
                      type="text"
                      className={`${inputCls} ${errors.arabicDescription ? 'border-red-400' : ''}`}
                      placeholder="إدخل الجامعة"
                      {...register('arabicDescription')}
                    />
                    {errors.arabicDescription?.message ? <span className={headerErrCls}>{String(errors.arabicDescription.message)}</span> : null}
                  </div>

                  {/* English Description */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">وصف انجليزي</label>
                    <input
                      type="text"
                      className={`${inputCls} ${errors.englishDescription ? 'border-red-400' : ''}`}
                      placeholder="إدخل الجامعة"
                      {...register('englishDescription')}
                    />
                    {errors.englishDescription?.message ? <span className={headerErrCls}>{String(errors.englishDescription.message)}</span> : null}
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">التاريخ</label>
                    <input type="date" className={`${inputCls} ${errors.date ? 'border-red-400' : ''}`} {...register('date')} />
                    {errors.date?.message ? <span className={headerErrCls}>{String(errors.date.message)}</span> : null}
                  </div>

                  {/* Year */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">السنة</label>
                    <select className={`${inputCls} ${errors.year ? 'border-red-400' : ''}`} {...register('year')}>
                      <option value="2023">2023</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                    {errors.year?.message ? <span className={headerErrCls}>{String(errors.year.message)}</span> : null}
                  </div>

                  {/* Month */}
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
                    {errors.month?.message ? <span className={headerErrCls}>{String(errors.month.message)}</span> : null}
                  </div>

                  {/* Cost Center */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">مركز التكلفة</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className={`${flexInputCls} ${errors.costCenter ? 'border-red-400' : ''}`}
                        placeholder="1212378971212"
                        {...register('costCenter')}
                      />
                      <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {errors.costCenter?.message ? <span className={headerErrCls}>{String(errors.costCenter.message)}</span> : null}
                  </div>
                </div>

                <div>
                  <div className={`${DASH_PANEL} p-5`}>
                    <div className="space-y-4">
                      {/* Department */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">الإدارة</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className={`${flexInputCls} ${errors.department ? 'border-red-400' : ''}`}
                            placeholder="1212378971212"
                            {...register('department')}
                          />
                          <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        {errors.department?.message ? <span className={headerErrCls}>{String(errors.department.message)}</span> : null}
                      </div>

                      {/* Section */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">القسم</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className={`${flexInputCls} ${errors.section ? 'border-red-400' : ''}`}
                            placeholder="1212378971212"
                            {...register('section')}
                          />
                          <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        {errors.section?.message ? <span className={headerErrCls}>{String(errors.section.message)}</span> : null}
                      </div>

                      {/* Job Cadre */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">الكادر الوظيفي</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className={`${flexInputCls} ${errors.jobCadre ? 'border-red-400' : ''}`}
                            placeholder="1212378971212"
                            {...register('jobCadre')}
                          />
                          <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        {errors.jobCadre?.message ? <span className={headerErrCls}>{String(errors.jobCadre.message)}</span> : null}
                      </div>

                      {/* Job Title */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">الوظيفة</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className={`${flexInputCls} ${errors.jobTitle ? 'border-red-400' : ''}`}
                            placeholder="1212378971212"
                            {...register('jobTitle')}
                          />
                          <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        {errors.jobTitle?.message ? <span className={headerErrCls}>{String(errors.jobTitle.message)}</span> : null}
                      </div>

                      {/* City */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">المدينة</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className={`${flexInputCls} ${errors.city ? 'border-red-400' : ''}`}
                            placeholder="1212378971212"
                            {...register('city')}
                          />
                          <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        {errors.city?.message ? <span className={headerErrCls}>{String(errors.city.message)}</span> : null}
                      </div>

                      {/* Wage Policy */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">سياسة الأجور</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className={`${flexInputCls} ${errors.wagePolicy ? 'border-red-400' : ''}`}
                            placeholder="1212378971212"
                            {...register('wagePolicy')}
                          />
                          <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        {errors.wagePolicy?.message ? <span className={headerErrCls}>{String(errors.wagePolicy.message)}</span> : null}
                      </div>

                      {/* Salary Branch */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">فرع الراتب</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className={`${flexInputCls} ${errors.salaryBranch ? 'border-red-400' : ''}`}
                            placeholder="1212378971212"
                            {...register('salaryBranch')}
                          />
                          <svg className="w-5 h-5 text-[#0E79AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        {errors.salaryBranch?.message ? <span className={headerErrCls}>{String(errors.salaryBranch.message)}</span> : null}
                      </div>

                      {/* Import from Attendance Sheet Button */}
                      <div className="text-center pt-4">
                        <button className="px-6 py-3 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                          إستيراد من شيت الحضور
                        </button>
                      </div>

                      {/* Load All Employees Button */}
                      <div className="text-center">
                        <button className="px-8 py-3 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                          تحميل كل الموظفين
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Absence and Overtime Table */}
            <div className="mb-8">
              <div className="overflow-x-auto rounded-lg border border-[#D6EAF3] scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-50">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="px-4 py-3 text-center font-medium">م</th>
                      <th className="px-4 py-3 text-right font-medium">رقم الموظف</th>
                      <th className="px-4 py-3 text-right font-medium">إسم الموظف</th>
                      <th className="px-4 py-3 text-center font-medium">ساعات التأخير</th>
                      <th className="px-4 py-3 text-center font-medium">قيمتها</th>
                      <th className="px-4 py-3 text-center font-medium">أيام الغياب</th>
                      <th className="px-4 py-3 text-center font-medium">قيمتها</th>
                      <th className="px-4 py-3 text-center font-medium">أيام الإضافي</th>
                      <th className="px-4 py-3 text-center font-medium">قيمتها</th>
                      <th className="px-4 py-3 text-center font-medium">إجمالي الغياب</th>
                      <th className="px-4 py-3 text-center font-medium">إجمالي الصافي</th>
                      <th className="px-4 py-3 text-center font-medium">الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absenceData.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{item.id}</td>
                        <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.employeeId}</div>
                        </td>
                        <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.employeeName}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.delayHours}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.delayValue}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.absenceDays}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.absenceValue}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.overtimeDays}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.overtimeValue}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.totalAbsence}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.totalNet}</div>
                        </td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                          <div className="text-sm">{item.net}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-[#D6EAF3]">
              <div className="flex gap-3 items-center">
                <button className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  طباعة
                </button>
                <CrudButtons />
              </div>
              <ActionButtons onSave={handleSubmit(onSaveHeader)} onCancel={() => reset(absenceOvertimeDefaults)} />
            </div>
      </div>
    </HrPageChrome>
  );
}
