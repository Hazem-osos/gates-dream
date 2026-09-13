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
  monthlySalariesDisbursementFormSchema,
  type MonthlySalariesDisbursementFormInput,
} from '@/lib/validation/hr.schema';

interface RowItem {
  id: number;
  number: string;
  name: string;
  salary: string;
  pay: string;
}

const defaults: MonthlySalariesDisbursementFormInput = {
  serialNumber: '',
  month: 'يناير',
  year: '2025',
  notes: '',
  record: '0000012345',
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function MonthlySalariesDisbursementPage() {
  useBackendReachability();

  const [rows] = useState<RowItem[]>([
    { id: 1, number: 'الرقم', name: 'إسم الموظف', salary: 'الراتب', pay: 'الدفع' },
    { id: 2, number: 'الرقم', name: 'إسم الموظف', salary: 'الراتب', pay: 'الدفع' },
    { id: 3, number: 'الرقم', name: 'إسم الموظف', salary: 'الراتب', pay: 'الدفع' },
    { id: 4, number: 'الرقم', name: 'إسم الموظف', salary: 'الراتب', pay: 'الدفع' },
    { id: 5, number: 'الرقم', name: 'إسم الموظف', salary: 'الراتب', pay: 'الدفع' },
  ]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MonthlySalariesDisbursementFormInput>({
    resolver: zodResolver(monthlySalariesDisbursementFormSchema) as Resolver<MonthlySalariesDisbursementFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onSave: SubmitHandler<MonthlySalariesDisbursementFormInput> = (values) => {
    console.info('[monthly-salaries-disbursement]', values);
  };

  const input = 'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';

  return (
    <HrPageChrome title="صرف الرواتب الشهرية للموظفين">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">المسلسل</label>
                    <input type="text" className={input} placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الشهر</label>
                    <select className={`${input} ${errors.month ? 'border-red-400' : ''}`} {...register('month')}>
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
                    <label className="block text-sm text-[#094C6B] mb-2">السنة</label>
                    <select className={`${input} ${errors.year ? 'border-red-400' : ''}`} {...register('year')}>
                      <option value="2023">2023</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                    {errors.year?.message ? <span className={errCls}>{String(errors.year.message)}</span> : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">ملاحظات</label>
                    <textarea
                      rows={4}
                      className={`${input} resize-none`}
                      placeholder="أدخل الملاحظات هنا..."
                      {...register('notes')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">القيد</label>
                    <button
                      type="button"
                      className="px-4 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] focus:ring-2 focus:ring-[#0E79AA] focus:ring-opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      القيد
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="overflow-x-auto rounded-lg border border-[#D6EAF3]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="px-4 py-3 text-center font-medium">م</th>
                      <th className="px-4 py-3 text-center font-medium">الرقم</th>
                      <th className="px-4 py-3 text-right font-medium">إسم الموظف</th>
                      <th className="px-4 py-3 text-center font-medium">الراتب</th>
                      <th className="px-4 py-3 text-center font-medium">الدفع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{row.id}</td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{row.number}</td>
                        <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">{row.name}</td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{row.salary}</td>
                        <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{row.pay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
