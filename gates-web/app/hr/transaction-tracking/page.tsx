'use client';

import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import {
  transactionTrackingFilterSchema,
  type TransactionTrackingFilterInput,
} from '@/lib/validation/hr.schema';
import { useApiQuery } from '@/lib/hooks/useApi';

interface EmployeeProcedureRow {
  id: string;
  serial?: string | null;
  procedureType: string;
  date: string;
  hijriDate?: string | null;
  description?: string | null;
  employee?: { arabicName?: string | null; serial?: string | null };
}

const filterDefaults: TransactionTrackingFilterInput = {
  hijriDate1: '26-11-2025',
  hijriDate2: '26-11-2025',
  employee: '1212378971212',
  fromDate: '26-11-2025',
  toDate: '26-11-2025',
  transactionType: '2025',
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function TransactionTrackingPage() {
  useBackendReachability();

  const [listQuery, setListQuery] = useState<{ search?: string; procedureType?: string }>({});

  const { data: proceduresRes, isFetching } = useApiQuery<EmployeeProcedureRow[]>(
    ['hr-employee-procedures', 'tracking', listQuery.search ?? '', listQuery.procedureType ?? ''],
    '/hr/employee-procedures',
    {
      limit: 100,
      search: listQuery.search || undefined,
      procedureType: listQuery.procedureType || undefined,
    }
  );
  const procedures = proceduresRes?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransactionTrackingFilterInput>({
    resolver: zodResolver(transactionTrackingFilterSchema) as Resolver<TransactionTrackingFilterInput>,
    defaultValues: filterDefaults,
    mode: 'onTouched',
  });

  const onSearch: SubmitHandler<TransactionTrackingFilterInput> = (values) => {
    setListQuery({
      search: values.employee?.trim() || undefined,
    });
  };

  return (
    <HrPageChrome title="متابعة المعاملات"
      onSave={handleSubmit(onSearch)}
      onNew={() => reset(filterDefaults)}
    >
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8">
              <div className="text-right mb-4">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4 lg:order-1">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الموظف</label>
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        className={`flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-[#094C6B] ${errors.employee ? 'border-red-400' : ''}`}
                        placeholder="الموظف"
                        {...register('employee')}
                      />
                      {errors.employee?.message ? <span className={errCls}>{String(errors.employee.message)}</span> : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">من التاريخ</label>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className={`flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-[#094C6B] ${errors.fromDate ? 'border-red-400' : ''}`}
                          placeholder="من التاريخ"
                          {...register('fromDate')}
                        />
                        <svg className="w-5 h-5 text-[#0E79AA] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      {errors.fromDate?.message ? <span className={errCls}>{String(errors.fromDate.message)}</span> : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الى التاريخ</label>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className={`flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-[#094C6B] ${errors.toDate ? 'border-red-400' : ''}`}
                          placeholder="الى التاريخ"
                          {...register('toDate')}
                        />
                        <svg className="w-5 h-5 text-[#0E79AA] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      {errors.toDate?.message ? <span className={errCls}>{String(errors.toDate.message)}</span> : null}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">نوع المعاملة</label>
                    <select
                      className={`h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${errors.transactionType ? 'border-red-400' : ''}`}
                      {...register('transactionType')}
                    >
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                      <option value="2023">2023</option>
                    </select>
                    {errors.transactionType?.message ? (
                      <span className={errCls}>{String(errors.transactionType.message)}</span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4 lg:order-2">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">هجري</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-[#094C6B]"
                        placeholder="التاريخ الهجري"
                        {...register('hijriDate1')}
                      />
                      <svg className="w-5 h-5 text-[#0E79AA] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">هجري</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg text-[#094C6B]"
                        placeholder="التاريخ الهجري"
                        {...register('hijriDate2')}
                      />
                      <svg className="w-5 h-5 text-[#0E79AA] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2"
                      onClick={() => reset(filterDefaults)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      مسح
                    </button>
                    <button
                      type="button"
                      className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2"
                      onClick={handleSubmit(onSearch)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      عرض
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
                      <th className="px-4 py-3 text-center font-medium">رقم</th>
                      <th className="px-4 py-3 text-right font-medium">الإدارة</th>
                      <th className="px-4 py-3 text-right font-medium">الموظف</th>
                      <th className="px-4 py-3 text-center font-medium">نوع المعاملة</th>
                      <th className="px-4 py-3 text-center font-medium">تاريحها</th>
                      <th className="px-4 py-3 text-center font-medium" colSpan={5}>
                        الإعتمادات
                      </th>
                    </tr>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="px-4 py-2 text-center font-medium" colSpan={6} />
                      <th className="px-4 py-2 text-center font-medium">إعتماد 1</th>
                      <th className="px-4 py-2 text-center font-medium">إعتماد 2</th>
                      <th className="px-4 py-2 text-center font-medium">إعتماد 3</th>
                      <th className="px-4 py-2 text-center font-medium">إعتماد 4</th>
                      <th className="px-4 py-2 text-center font-medium">إعتماد 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetching ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-6 text-center text-gray-500 border-b border-[#D6EAF3]">
                          جاري تحميل الإجراءات…
                        </td>
                      </tr>
                    ) : procedures.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-6 text-center text-gray-500 border-b border-[#D6EAF3]">
                          لا توجد إجراءات موظفين مطابقة. اضغط «عرض» بعد ضبط المرشحات.
                        </td>
                      </tr>
                    ) : (
                      procedures.map((row, idx) => (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{idx + 1}</td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{row.serial || '—'}</td>
                          <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">—</td>
                          <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">
                            {row.employee?.arabicName || '—'}
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{row.procedureType}</td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                            {row.date ? new Date(row.date).toLocaleDateString('ar-EG') : '—'}
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">—</td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">—</td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">—</td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">—</td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">—</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
      </div>
    </HrPageChrome>
  );
}
