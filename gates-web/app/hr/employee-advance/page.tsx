'use client';

import { useState, useEffect } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { employeeAdvanceFormSchema, type EmployeeAdvanceFormInput } from '@/lib/validation/hr.schema';

import type { ApiError } from '@/lib/api/types';

interface Employee {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

const emptyDefaults: EmployeeAdvanceFormInput = {
  serialNumber: '',
  employee: '',
  date: '',
  hijriDate: '',
  value: '',
  monthlyInstallment: '',
  fromMonth: '',
  toYear: '',
  notes: '',
  record: '',
  paymentMethod: 'fund',
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function EmployeeAdvancePage() {
  const invalidateQuery = useInvalidateQuery();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmployeeAdvanceFormInput>({
    resolver: zodResolver(employeeAdvanceFormSchema) as Resolver<EmployeeAdvanceFormInput>,
    defaultValues: emptyDefaults,
    mode: 'onTouched',
  });

  const paymentMethod = watch('paymentMethod');

  const { data: employeesResponse } = useApiQuery<Employee[]>(
    ['employees'],
    '/hr/employees',
    { limit: 1000, isActive: true }
  );
  const employees = employeesResponse?.data || [];

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    reset({
      ...emptyDefaults,
      date: today,
      hijriDate: today,
    });
  }, [reset]);

  const advanceMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/hr/employee-advances',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ السلفة بنجاح');
        invalidateQuery(['employee-advances']);
        const today = new Date().toISOString().split('T')[0];
        reset({
          ...emptyDefaults,
          date: today,
          hijriDate: today,
          paymentMethod: 'fund',
        });
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const onValidSubmit: SubmitHandler<EmployeeAdvanceFormInput> = async (data) => {
    setError('');
    setSuccess('');
    try {
      await advanceMutation.mutateAsync({
        employeeId: data.employee,
        serial: data.serialNumber || undefined,
        date: data.date,
        hijriDate: data.hijriDate || undefined,
        value: parseFloat(String(data.value).replace(',', '.')),
        monthlyInstallment: data.monthlyInstallment
          ? parseFloat(String(data.monthlyInstallment).replace(',', '.'))
          : undefined,
        fromMonth: data.fromMonth || undefined,
        toYear: data.toYear || undefined,
        notes: data.notes || undefined,
        record: data.record || undefined,
        paymentMethod: data.paymentMethod,
      });
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : undefined) || 'حدث خطأ أثناء الحفظ');
    }
  };

  const onCancel = () => {
    const today = new Date().toISOString().split('T')[0];
    reset({
      ...emptyDefaults,
      date: today,
      hijriDate: today,
      paymentMethod: 'fund',
    });
    setError('');
  };

  return (
    <HrPageChrome title="سلفة لموظف">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8 space-y-6">
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4 lg:order-2">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2 font-semibold">طريقة الدفع</label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setValue('paymentMethod', 'bank', { shouldValidate: true })}
                        className={`px-6 py-3 rounded-lg border-2 transition-all duration-300 transform hover:scale-105 ${
                          paymentMethod === 'bank'
                            ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg shadow-[#0E79AA]/30 ring-2 ring-[#0E79AA]/20'
                            : 'bg-white text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#F6FBFD] hover:shadow-md'
                        }`}
                      >
                        بنك
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('paymentMethod', 'fund', { shouldValidate: true })}
                        className={`px-6 py-3 rounded-lg border-2 transition-all duration-300 transform hover:scale-105 ${
                          paymentMethod === 'fund'
                            ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg shadow-[#0E79AA]/30 ring-2 ring-[#0E79AA]/20'
                            : 'bg-white text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#F6FBFD] hover:shadow-md'
                        }`}
                      >
                        صندوق
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الى سنة</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B]"
                      placeholder="السنة"
                      {...register('toYear')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">القيد</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B]"
                      placeholder="رقم القيد"
                      {...register('record')}
                    />
                  </div>
                </div>

                <div className="space-y-4 lg:order-1">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">المسلسل</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B]"
                      placeholder="إدخل رقم المسلسل"
                      {...register('serialNumber')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الموظف</label>
                    <select
                      className={`w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] ${errors.employee ? 'border-red-400' : ''}`}
                      {...register('employee')}
                    >
                      <option value="">اختر الموظف</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.code} - {emp.arabicName}
                        </option>
                      ))}
                    </select>
                    {errors.employee?.message ? <span className={errCls}>{String(errors.employee.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">التاريخ</label>
                    <input
                      type="date"
                      className={`w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] ${errors.date ? 'border-red-400' : ''}`}
                      {...register('date')}
                    />
                    {errors.date?.message ? <span className={errCls}>{String(errors.date.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">القيمة</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] ${errors.value ? 'border-red-400' : ''}`}
                      placeholder="القيمة"
                      {...register('value')}
                    />
                    {errors.value?.message ? <span className={errCls}>{String(errors.value.message)}</span> : null}
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">القسط الشهري</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B]"
                      placeholder="القسط الشهري"
                      {...register('monthlyInstallment')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">من شهر</label>
                    <select
                      className="w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B]"
                      {...register('fromMonth')}
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
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#094C6B] mb-2">ملاحظات</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B] resize-none"
                  placeholder="أدخل الملاحظات هنا..."
                  {...register('notes')}
                />
              </div>

              <div className="flex justify-end mt-8 pt-6 border-t border-[#D6EAF3]">
                <ActionButtons
                  onSave={handleSubmit(onValidSubmit)}
                  onCancel={onCancel}
                  saveText={advanceMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                />
              </div>
            </div>
      </div>

      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
    </HrPageChrome>
  );
}
