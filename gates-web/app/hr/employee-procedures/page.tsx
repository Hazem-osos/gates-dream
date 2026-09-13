'use client';

import { useState, useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { useApiQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import {
  hrMonthlyOperationsHeaderSchema,
  type HrMonthlyOperationsHeaderInput,
} from '@/lib/validation/hr.schema';

interface Employee {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Procedure {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface EmployeeProcedure {
  id: string;
  employeeId: string;
  employee?: Employee;
  procedureType: string;
  date: string;
  hijriDate?: string;
  description?: string;
  amount?: number;
  unit?: string;
  reason?: string;
}

const headerDefaults: HrMonthlyOperationsHeaderInput = {
  serialNumber: '',
  department: '',
  section: '',
  jobCadre: '',
  jobTitle: '',
  city: '',
  wagePolicy: '',
  salaryBranch: '',
  costCenter: '',
  arabicDescription: '',
  englishDescription: '',
  date: '',
  hijriDate: '',
  year: new Date().getFullYear().toString(),
  month: '',
  record: '',
};

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function EmployeeProceduresPage() {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<HrMonthlyOperationsHeaderInput>({
    resolver: zodResolver(hrMonthlyOperationsHeaderSchema) as Resolver<HrMonthlyOperationsHeaderInput>,
    defaultValues: headerDefaults,
    mode: 'onTouched',
  });

  const department = watch('department');
  const year = watch('year');
  const month = watch('month');

  const [proceduresData, setProceduresData] = useState<EmployeeProcedure[]>([]);
  const [error, setError] = useState('');

  // Fetch employees (department from header drives cache key + API filter)
  useApiQuery<Employee[]>(
    ['employees', department],
    '/hr/employees',
    {
      limit: 1000,
      isActive: true,
      departmentId: department || undefined,
    }
  );

  // Master procedures list
  useApiQuery<Procedure[]>(['procedures'], '/hr/procedures', { limit: 1000, isActive: true });

  // Fetch employee procedures
  const { data: employeeProceduresResponse, refetch: refetchProcedures } = useApiQuery<
    EmployeeProcedure[]
  >(
    ['employee-procedures', year, month],
    '/hr/employee-procedures',
    {
      limit: 1000,
      startDate:
        year && month ? new Date(`${year}-${month}-01`) : undefined,
      endDate:
        year && month ? new Date(`${year}-${month}-31`) : undefined,
    }
  );

  // Update procedures data when API response changes
  useEffect(() => {
    if (employeeProceduresResponse?.data) {
      setProceduresData(employeeProceduresResponse.data);
    }
  }, [employeeProceduresResponse]);

  // Initialize date
  useEffect(() => {
    const today = new Date();
    const d = today.toISOString().split('T')[0];
    setValue('date', d);
    setValue('hijriDate', d);
  }, [setValue]);

  const submitHeader = handleSubmit(() => {
    refetchProcedures();
  });

  return (
    <HrPageChrome title="إجراءات الموظفين">
      <div className={`${DASH_PANEL} p-5`}>
            {/* Form Section */}
            <div className="mb-8 space-y-6">
              {/* Section Title */}
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <input type="hidden" {...register('record')} />

              {/* Form Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Right Column (Now Left) */}
                <div className="space-y-4">
                  {/* Serial Number */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">المسلسل</label>
                    <input type="text" className={inputCls} {...register('serialNumber')} />
                    {errors.serialNumber?.message ? (
                      <span className={errCls}>{String(errors.serialNumber.message)}</span>
                    ) : null}
                  </div>

                  {/* Arabic Description */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">وصف عربي</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="إدخل الجامعة"
                      {...register('arabicDescription')}
                    />
                    {errors.arabicDescription?.message ? (
                      <span className={errCls}>{String(errors.arabicDescription.message)}</span>
                    ) : null}
                  </div>

                  {/* English Description */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">وصف انجليزي</label>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="إدخل الجامعة"
                      {...register('englishDescription')}
                    />
                    {errors.englishDescription?.message ? (
                      <span className={errCls}>{String(errors.englishDescription.message)}</span>
                    ) : null}
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">التاريخ</label>
                    <input type="date" className={inputCls} {...register('date')} />
                    {errors.date?.message ? (
                      <span className={errCls}>{String(errors.date.message)}</span>
                    ) : null}
                  </div>

                  {/* Year */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">السنة</label>
                    <select className={inputCls} {...register('year')}>
                      <option value="2023">2023</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                    {errors.year?.message ? (
                      <span className={errCls}>{String(errors.year.message)}</span>
                    ) : null}
                  </div>

                  {/* Month */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">الشهر</label>
                    <select className={inputCls} {...register('month')}>
                      <option value="">اختر الشهر</option>
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
                    {errors.month?.message ? (
                      <span className={errCls}>{String(errors.month.message)}</span>
                    ) : null}
                  </div>

                  {/* Cost Center */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">مركز التكلفة</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                        placeholder="إدخل الجامعة"
                        {...register('costCenter')}
                      />
                      <input
                        type="text"
                        className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                        placeholder="1212378971212"
                      />
                    </div>
                    {errors.costCenter?.message ? (
                      <span className={errCls}>{String(errors.costCenter.message)}</span>
                    ) : null}
                  </div>
                </div>

                {/* Left Column (Now Right) */}
                <div>
                  <div className={`${DASH_PANEL} p-5`}>
                    <div className="space-y-4">
                      {/* Department */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">الإدارة</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="إدخل الجامعة"
                            {...register('department')}
                          />
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="1212378971212"
                          />
                        </div>
                        {errors.department?.message ? (
                          <span className={errCls}>{String(errors.department.message)}</span>
                        ) : null}
                      </div>

                      {/* Section */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">القسم</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="إدخل الجامعة"
                            {...register('section')}
                          />
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="1212378971212"
                          />
                        </div>
                        {errors.section?.message ? (
                          <span className={errCls}>{String(errors.section.message)}</span>
                        ) : null}
                      </div>

                      {/* Job Cadre */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">الكادر الوظيفي</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="إدخل الجامعة"
                            {...register('jobCadre')}
                          />
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="1212378971212"
                          />
                        </div>
                        {errors.jobCadre?.message ? (
                          <span className={errCls}>{String(errors.jobCadre.message)}</span>
                        ) : null}
                      </div>

                      {/* Job Title */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">الوظيفة</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="إدخل الجامعة"
                            {...register('jobTitle')}
                          />
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="1212378971212"
                          />
                        </div>
                        {errors.jobTitle?.message ? (
                          <span className={errCls}>{String(errors.jobTitle.message)}</span>
                        ) : null}
                      </div>

                      {/* City */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">المدينة</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="إدخل الجامعة"
                            {...register('city')}
                          />
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="1212378971212"
                          />
                        </div>
                        {errors.city?.message ? (
                          <span className={errCls}>{String(errors.city.message)}</span>
                        ) : null}
                      </div>

                      {/* Wage Policy */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">سياسة الأجور</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="إدخل الجامعة"
                            {...register('wagePolicy')}
                          />
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="1212378971212"
                          />
                        </div>
                        {errors.wagePolicy?.message ? (
                          <span className={errCls}>{String(errors.wagePolicy.message)}</span>
                        ) : null}
                      </div>

                      {/* Salary Branch */}
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">فرع الراتب</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="إدخل الجامعة"
                            {...register('salaryBranch')}
                          />
                          <input
                            type="text"
                            className="flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                            placeholder="1212378971212"
                          />
                        </div>
                        {errors.salaryBranch?.message ? (
                          <span className={errCls}>{String(errors.salaryBranch.message)}</span>
                        ) : null}
                      </div>

                      {/* Load All Employees Button */}
                      <div className="text-center pt-4">
                        <button
                          type="button"
                          className="px-8 py-3 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors"
                        >
                          تحميل كل الموظفين
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Procedures Table */}
            <div className="mb-8">
              <div className="overflow-x-auto rounded-lg border border-[#D6EAF3] scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-50">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="px-4 py-3 text-center font-medium">م</th>
                      <th className="px-4 py-3 text-right font-medium">رقم الموظف</th>
                      <th className="px-4 py-3 text-right font-medium">إسم الموظف</th>
                      <th className="px-4 py-3 text-center font-medium">الإجراء</th>
                      <th className="px-4 py-3 text-center font-medium">طبيعته</th>
                      <th className="px-4 py-3 text-center font-medium">نوعه</th>
                      <th className="px-4 py-3 text-center font-medium">الوحدة</th>
                      <th className="px-4 py-3 text-center font-medium">القيمة</th>
                      <th className="px-4 py-3 text-center font-medium">القيمة المالية</th>
                      <th className="px-4 py-3 text-center font-medium">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proceduresData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                          لا توجد بيانات للعرض
                        </td>
                      </tr>
                    ) : (
                      proceduresData.map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">{index + 1}</td>
                          <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">
                            <div className="text-sm">{item.employee?.code || item.employeeId}</div>
                          </td>
                          <td className="px-4 py-3 text-right border-b border-[#D6EAF3]">
                            <div className="text-sm">{item.employee?.arabicName || 'غير محدد'}</div>
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                            <div className="text-sm">{item.procedureType || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                            <div className="text-sm">-</div>
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                            <div className="text-sm">-</div>
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                            <div className="text-sm">{item.unit || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                            <div className="text-sm">{item.amount?.toLocaleString() || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                            <div className="text-sm">{item.amount?.toLocaleString() || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-center border-b border-[#D6EAF3]">
                            <div className="text-sm">{item.description || item.reason || '-'}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-[#D6EAF3]">
              <CrudButtons
                onAdd={() => {
                  setError('يرجى إضافة إجراء جديد من خلال النموذج');
                }}
              />
              <ActionButtons onSave={submitHeader} />
            </div>
      </div>

      {/* Toast Notifications */}
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
    </HrPageChrome>
  );
}
