'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { attendanceFingerprintFormSchema, type AttendanceFingerprintFormInput } from '@/lib/validation/hr.schema';

const defaults: AttendanceFingerprintFormInput = {
  month: 'يناير',
  year: '2025',
  monthDays: '',
  sheet: '1212378971212',
  date: '2025-02-22',
  employeeId: '1212342',
  entryExitCode: '12342354',
  time: '08:00',
};

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function AttendanceSheetFingerprintPage() {
  useBackendReachability();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AttendanceFingerprintFormInput>({
    resolver: zodResolver(attendanceFingerprintFormSchema) as Resolver<AttendanceFingerprintFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<AttendanceFingerprintFormInput> = (values) => {
    console.info('[attendance-sheet-fingerprint]', values);
  };

  return (
    <HrPageChrome title="شيت الحضور من جهاز البصمة">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الشهر</label>
                    <select
                      className={`${inputCls} ${errors.month ? 'border-red-400' : ''}`}
                      {...register('month')}
                    >
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
                    {errors.month?.message ? <span className={errCls}>{String(errors.month.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">إعداد أيام الشهر</label>
                    <button
                      type="button"
                      className="px-4 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] focus:ring-2 focus:ring-[#0E79AA] focus:ring-opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      إعداد أيام الشهر
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">التاريخ</label>
                    <input type="date" className={`${inputCls} ${errors.date ? 'border-red-400' : ''}`} {...register('date')} />
                    {errors.date?.message ? <span className={errCls}>{String(errors.date.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">رمز الدخول والخروج</label>
                    <input
                      type="text"
                      className={`${inputCls} ${errors.entryExitCode ? 'border-red-400' : ''}`}
                      {...register('entryExitCode')}
                    />
                    {errors.entryExitCode?.message ? (
                      <span className={errCls}>{String(errors.entryExitCode.message)}</span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">السنة</label>
                    <select className={`${inputCls} ${errors.year ? 'border-red-400' : ''}`} {...register('year')}>
                      <option value="2023">2023</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                    {errors.year?.message ? <span className={errCls}>{String(errors.year.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الشيت</label>
                    <div className="flex items-center gap-2">
                      <select
                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-sm"
                        defaultValue="sheet"
                      >
                        <option value="sheet">الشيت</option>
                        <option value="s1">شيت 1</option>
                        <option value="s2">شيت 2</option>
                      </select>
                      <input
                        type="text"
                        className={`flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-sm ${errors.sheet ? 'border-red-400' : ''}`}
                        placeholder="1212378971212"
                        {...register('sheet')}
                      />
                    </div>
                    {errors.sheet?.message ? <span className={errCls}>{String(errors.sheet.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">رقم الموظف</label>
                    <input
                      type="text"
                      className={`${inputCls} ${errors.employeeId ? 'border-red-400' : ''}`}
                      {...register('employeeId')}
                    />
                    {errors.employeeId?.message ? <span className={errCls}>{String(errors.employeeId.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الوقت</label>
                    <input type="time" className={`${inputCls} ${errors.time ? 'border-red-400' : ''}`} {...register('time')} />
                    {errors.time?.message ? <span className={errCls}>{String(errors.time.message)}</span> : null}
                  </div>
                </div>
              </div>

              <div className="flex justify-end items-center">
                <ActionButtons onSave={handleSubmit(onSave)} onCancel={() => reset(defaults)} />
              </div>
            </div>
      </div>
    </HrPageChrome>
  );
}
