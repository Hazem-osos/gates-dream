'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Users, Banknote, TrendingDown, Wallet } from 'lucide-react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  KpiSummaryCard,
  ModuleKpiGrid,
  WorkflowStepper,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseThClass,
  denseTdClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  hrMonthlyOperationsHeaderSchema,
  type HrMonthlyOperationsHeaderInput,
} from '@/lib/validation/hr.schema';

import type { ApiError } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Department {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface CostCenter {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface WagePolicy {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface JobTitle {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface JobCadre {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface City {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface MonthlySalary {
  id: string;
  employeeId: string;
  employee?: Employee;
  workDays?: number;
  basicSalary: number;
  totalAllowances?: number;
  salaryAndAllowances?: number;
  totalDeductions?: number;
  additions?: number;
  discounts?: number;
  overtime?: number;
  absence?: number;
  advances?: number;
  employeeInsurance?: number;
  companyInsurance?: number;
  netSalary: number;
  periodYear: string;
  periodMonth: string;
  date: string;
  hijriDate?: string;
  record?: string;
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

const WORKFLOW_STEPS = [
  { id: 'draft', label: 'مسودة' },
  { id: 'approval', label: 'اعتماد مالي' },
  { id: 'post', label: 'ترحيل القيود وصرف الرواتب' },
];

const stickyCodeClass = 'sticky right-0 z-20 min-w-[100px] bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]';
const stickyNameClass =
  'sticky right-[100px] z-20 min-w-[140px] bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]';
const stickyHeadClass = 'bg-slate-50';

const moneyTh = cn(denseThClass, 'min-w-[100px] text-center');
const moneyTd = cn(denseTdClass, 'min-w-[100px] text-center tabular-nums');

export default function MonthlySalariesPage() {
  const invalidateQuery = useInvalidateQuery();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<HrMonthlyOperationsHeaderInput>({
    resolver: zodResolver(hrMonthlyOperationsHeaderSchema) as Resolver<HrMonthlyOperationsHeaderInput>,
    defaultValues: headerDefaults,
    mode: 'onTouched',
  });

  const department = watch('department');
  const jobTitle = watch('jobTitle');
  const jobCadre = watch('jobCadre');
  const city = watch('city');
  const year = watch('year');
  const month = watch('month');

  const [salaryData, setSalaryData] = useState<MonthlySalary[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [payrollRunId, setPayrollRunId] = useState<string | null>(null);
  const [accrualPosted, setAccrualPosted] = useState(false);
  const [wave3Busy, setWave3Busy] = useState(false);

  const { data: departmentsResponse } = useApiQuery<Department[]>(
    ['departments'],
    '/hr/departments',
    { limit: 1000, isActive: true }
  );
  const departments = departmentsResponse?.data || [];

  const { data: costCentersResponse } = useApiQuery<CostCenter[]>(
    ['cost-centers'],
    '/accounting/cost-centers',
    { limit: 1000, isActive: true }
  );
  const costCenters = costCentersResponse?.data || [];

  const { data: wagePoliciesResponse } = useApiQuery<WagePolicy[]>(
    ['wage-policies'],
    '/hr/wage-policies',
    { limit: 1000, isActive: true }
  );
  const wagePolicies = wagePoliciesResponse?.data || [];

  const { data: jobTitlesResponse } = useApiQuery<JobTitle[]>(
    ['job-titles'],
    '/hr/job-titles',
    { limit: 1000, isActive: true }
  );
  const jobTitles = jobTitlesResponse?.data || [];

  const { data: jobCadresResponse } = useApiQuery<JobCadre[]>(
    ['job-cadres'],
    '/hr/job-cadres',
    { limit: 1000, isActive: true }
  );
  const jobCadres = jobCadresResponse?.data || [];

  const { data: citiesResponse } = useApiQuery<City[]>(
    ['cities'],
    '/hr/cities',
    { limit: 1000, isActive: true }
  );
  const cities = citiesResponse?.data || [];

  const { refetch: refetchEmployees } = useApiQuery<Employee[]>(
    ['employees', department, jobTitle, jobCadre, city],
    '/hr/employees',
    {
      limit: 1000,
      isActive: true,
      departmentId: department || undefined,
    }
  );

  const { data: salariesResponse, refetch: refetchSalaries } = useApiQuery<MonthlySalary[]>(
    ['monthly-salaries', year, month],
    '/hr/monthly-salaries',
    {
      limit: 1000,
      periodYear: year || undefined,
      periodMonth: month || undefined,
    }
  );

  useEffect(() => {
    if (salariesResponse?.data) {
      setSalaryData(salariesResponse.data);
    }
  }, [salariesResponse]);

  useEffect(() => {
    const today = new Date();
    const d = today.toISOString().split('T')[0];
    setValue('date', d);
    setValue('hijriDate', d);
  }, [setValue]);

  const salaryMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/hr/monthly-salaries',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الرواتب الشهرية بنجاح');
        invalidateQuery(['monthly-salaries']);
        refetchSalaries();
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const kpiTotals = useMemo(() => {
    return salaryData.reduce(
      (acc, row) => ({
        basic: acc.basic + (row.basicSalary || 0),
        net: acc.net + (row.netSalary || 0),
        deductions: acc.deductions + (row.totalDeductions || 0),
      }),
      { basic: 0, net: 0, deductions: 0 }
    );
  }, [salaryData]);

  const workflowIndex = accrualPosted ? 2 : payrollRunId ? 1 : 0;

  const handleLoadEmployees = async () => {
    try {
      await refetchEmployees();
      setSuccess('تم تحميل الموظفين بنجاح');
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : undefined) || 'حدث خطأ أثناء تحميل الموظفين');
    }
  };

  const handleSaveSalaries: SubmitHandler<HrMonthlyOperationsHeaderInput> = async () => {
    if (salaryData.length === 0) {
      setError('لا توجد رواتب للحفظ');
      return;
    }

    const { year: y, month: m, date, hijriDate, record } = getValues();

    try {
      for (const salary of salaryData) {
        await salaryMutation.mutateAsync({
          employeeId: salary.employeeId,
          periodYear: y,
          periodMonth: m,
          date,
          hijriDate,
          workDays: salary.workDays,
          basicSalary: salary.basicSalary,
          totalAllowances: salary.totalAllowances,
          totalDeductions: salary.totalDeductions,
          additions: salary.additions,
          discounts: salary.discounts,
          overtime: salary.overtime,
          absence: salary.absence,
          advances: salary.advances,
          employeeInsurance: salary.employeeInsurance,
          companyInsurance: salary.companyInsurance,
          netSalary: salary.netSalary,
          record,
        });
      }
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : undefined) || 'حدث خطأ أثناء الحفظ');
    }
  };

  const submitSave = handleSubmit(handleSaveSalaries);

  const buildEmployeeInputs = (): Record<string, { overtime?: number }> => {
    const inputs: Record<string, { overtime?: number }> = {};
    for (const row of salaryData) {
      if (!row.employeeId) continue;
      inputs[row.employeeId] = { overtime: row.overtime ?? 0 };
    }
    return inputs;
  };

  const handleWave3CreateRun = async () => {
    setError('');
    setSuccess('');
    const periodYear = Number(getValues('year'));
    const periodMonth = Number(getValues('month'));
    if (!periodYear || !periodMonth) {
      setError('حدد السنة والشهر قبل إنشاء مسير Wave 3');
      return;
    }
    setWave3Busy(true);
    try {
      const res = await apiClient.post<{ id: string }>('/hr/payroll-runs', {
        periodYear,
        periodMonth,
        employeeInputs: buildEmployeeInputs(),
      });
      setPayrollRunId(res.data.id);
      setSuccess('تم إنشاء مسير الرواتب (Wave 3)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء مسير الرواتب');
    } finally {
      setWave3Busy(false);
    }
  };

  const handleWave3PostAccrual = async () => {
    if (!payrollRunId) {
      setError('أنشئ مسير Wave 3 أولاً');
      return;
    }
    setWave3Busy(true);
    setError('');
    try {
      await apiClient.post(`/hr/payroll-runs/${payrollRunId}/post-accrual`);
      setAccrualPosted(true);
      setSuccess('تم ترحيل استحقاق الرواتب إلى دفتر الأستاذ');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'تعذر ترحيل الاستحقاق');
    } finally {
      setWave3Busy(false);
    }
  };

  return (
    <HrPageChrome title="مسير الرواتب الشهري" onSave={submitSave} savePending={salaryMutation.isPending}>
        <ModuleKpiGrid className="mb-4">
          <KpiSummaryCard label="عدد الموظفين" value={salaryData.length} icon={Users} />
          <KpiSummaryCard
            label="إجمالي الأساسي"
            value={kpiTotals.basic.toLocaleString()}
            icon={Banknote}
          />
          <KpiSummaryCard label="إجمالي الصافي" value={kpiTotals.net.toLocaleString()} icon={Wallet} />
          <KpiSummaryCard
            label="إجمالي الاستقطاعات"
            value={kpiTotals.deductions.toLocaleString()}
            icon={TrendingDown}
          />
        </ModuleKpiGrid>

        <FormSectionCard title="بيانات المسير" subtitle="الفترة والإدارة">
          <CompactFormField label="المسلسل" error={errors.serialNumber?.message} {...register('serialNumber')} />
          <CompactFormField label="التاريخ" type="date" error={errors.date?.message} {...register('date')} />
          <CompactFormField label="السنة" error={errors.year?.message}>
            <select className={compactControlClass} {...register('year')}>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </CompactFormField>
          <CompactFormField label="الشهر" error={errors.month?.message}>
            <select className={compactControlClass} {...register('month')}>
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
          </CompactFormField>
          <CompactFormField label="الإدارة" error={errors.department?.message}>
            <select className={compactControlClass} {...register('department')}>
              <option value="">اختر الإدارة</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.arabicName}
                </option>
              ))}
            </select>
          </CompactFormField>
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={9}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="وصف عربي"
              placeholder="وصف عربي"
              error={errors.arabicDescription?.message}
              {...register('arabicDescription')}
            />
            <CompactFormField
              label="وصف انجليزي"
              placeholder="وصف انجليزي"
              error={errors.englishDescription?.message}
              {...register('englishDescription')}
            />
            <CompactFormField label="الكادر الوظيفي" error={errors.jobCadre?.message}>
              <select className={compactControlClass} {...register('jobCadre')}>
                <option value="">اختر الكادر الوظيفي</option>
                {jobCadres.map((cadre) => (
                  <option key={cadre.id} value={cadre.id}>
                    {cadre.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField label="الوظيفة" error={errors.jobTitle?.message}>
              <select className={compactControlClass} {...register('jobTitle')}>
                <option value="">اختر الوظيفة</option>
                {jobTitles.map((title) => (
                  <option key={title.id} value={title.id}>
                    {title.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField label="المدينة" error={errors.city?.message}>
              <select className={compactControlClass} {...register('city')}>
                <option value="">اختر المدينة</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField label="سياسة الأجور" error={errors.wagePolicy?.message}>
              <select className={compactControlClass} {...register('wagePolicy')}>
                <option value="">اختر سياسة الأجور</option>
                {wagePolicies.map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="فرع الراتب"
              placeholder="1212378971212"
              error={errors.salaryBranch?.message}
              {...register('salaryBranch')}
            />
            <CompactFormField label="مركز التكلفة" error={errors.costCenter?.message}>
              <select className={compactControlClass} {...register('costCenter')}>
                <option value="">اختر مركز التكلفة</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="القسم"
              placeholder="1212378971212"
              error={errors.section?.message}
              {...register('section')}
            />
            <CompactFormField
              label="رقم القيد"
              placeholder="رقم القيد"
              error={errors.record?.message}
              {...register('record')}
            />
          </div>
        </AdvancedFieldsSection>

        <section className="mb-4 rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#094C6B]">جدول الرواتب</h2>
            <button
              type="button"
              onClick={handleLoadEmployees}
              className="h-9 rounded-lg bg-[#0E79AA] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B6188]"
            >
              تحميل كل الموظفين
            </button>
          </div>

          <div className={denseTableWrapClass}>
            <table className={denseTableClass}>
              <thead>
                <tr className="h-10 bg-[#0E79AA] text-xs font-semibold text-white">
                  <th colSpan={3} className="border-l border-[#0B6188]/30 px-2" />
                  <th colSpan={2} className="border-l border-[#0B6188]/30 px-2 text-center">
                    الراتب الأساسي
                  </th>
                  <th colSpan={2} className="border-l border-[#0B6188]/30 px-2 text-center">
                    إجمالي البدلات
                  </th>
                  <th colSpan={3} className="border-l border-[#0B6188]/30 px-2 text-center">
                    المكافآت والإضافي
                  </th>
                  <th colSpan={2} className="border-l border-[#0B6188]/30 px-2 text-center">
                    الغيابات والجزاءات
                  </th>
                  <th colSpan={3} className="border-l border-[#0B6188]/30 px-2 text-center">
                    السلف والأقساط
                  </th>
                  <th colSpan={2} className="px-2 text-center">صافي الراتب المستحق</th>
                </tr>
                <tr className="h-10 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className={cn(denseThClass, 'w-10 text-center')}>م</th>
                  <th className={cn(denseThClass, stickyCodeClass, stickyHeadClass)}>رقم الموظف</th>
                  <th className={cn(denseThClass, stickyNameClass, stickyHeadClass)}>إسم الموظف</th>
                  <th className={moneyTh}>أيام العمل</th>
                  <th className={moneyTh}>الراتب</th>
                  <th className={moneyTh}>إجمالى البدلات</th>
                  <th className={moneyTh}>الراتب والبدلات</th>
                  <th className={moneyTh}>إضافات</th>
                  <th className={moneyTh}>خصومات</th>
                  <th className={moneyTh}>إضافي</th>
                  <th className={moneyTh}>غياب</th>
                  <th className={moneyTh}>إجمالي إستقطاع</th>
                  <th className={moneyTh}>سلف</th>
                  <th className={moneyTh}>تأمينات الموظف</th>
                  <th className={moneyTh}>تأمينات الشركة</th>
                  <th className={moneyTh}>صافي الراتب</th>
                  <th className={denseThClass}>الوظيفة</th>
                </tr>
              </thead>
              <tbody>
                {salaryData.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-8 text-center text-sm text-slate-500">
                      لا توجد بيانات للعرض
                    </td>
                  </tr>
                ) : (
                  salaryData.map((item, index) => (
                    <tr
                      key={item.id}
                      className={cn('h-10 border-b border-slate-100 transition-colors hover:bg-slate-50/80', index % 2 === 1 && 'bg-[#0E79AA0D]/40')}
                    >
                      <td className={cn(denseTdClass, 'text-center')}>{index + 1}</td>
                      <td className={cn(denseTdClass, stickyCodeClass, index % 2 === 1 ? 'bg-[#0E79AA0D]/40' : 'bg-white')}>
                        {item.employee?.code || item.employeeId}
                      </td>
                      <td className={cn(denseTdClass, stickyNameClass, index % 2 === 1 ? 'bg-[#0E79AA0D]/40' : 'bg-white')}>
                        {item.employee?.arabicName || 'غير محدد'}
                      </td>
                      <td className={moneyTd}>{item.workDays || 0}</td>
                      <td className={moneyTd}>{item.basicSalary?.toLocaleString() || '0'}</td>
                      <td className={moneyTd}>{(item.totalAllowances || 0).toLocaleString()}</td>
                      <td className={moneyTd}>
                        {(item.salaryAndAllowances || item.basicSalary + (item.totalAllowances || 0)).toLocaleString()}
                      </td>
                      <td className={moneyTd}>{(item.additions || 0).toLocaleString()}</td>
                      <td className={moneyTd}>{(item.discounts || 0).toLocaleString()}</td>
                      <td className={moneyTd}>{(item.overtime || 0).toLocaleString()}</td>
                      <td className={moneyTd}>{(item.absence || 0).toLocaleString()}</td>
                      <td className={moneyTd}>{(item.totalDeductions || 0).toLocaleString()}</td>
                      <td className={moneyTd}>{(item.advances || 0).toLocaleString()}</td>
                      <td className={moneyTd}>{(item.employeeInsurance || 0).toLocaleString()}</td>
                      <td className={moneyTd}>{(item.companyInsurance || 0).toLocaleString()}</td>
                      <td className={cn(moneyTd, 'font-semibold text-[#0E79AA]')}>
                        {item.netSalary?.toLocaleString() || '0'}
                      </td>
                      <td className={denseTdClass}>—</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-4 rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-[#094C6B]">مسار الاعتماد</h3>
          <WorkflowStepper steps={WORKFLOW_STEPS} currentIndex={workflowIndex} className="mb-4" />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={wave3Busy || Boolean(payrollRunId)}
              onClick={() => void handleWave3CreateRun()}
              className="h-9 rounded-lg bg-[#0E79AA] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B6188] disabled:opacity-50"
            >
              إنشاء مسودة
            </button>
            <button
              type="button"
              disabled={wave3Busy || !payrollRunId || accrualPosted}
              onClick={submitSave}
              className="h-9 rounded-lg bg-[#0B6188] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#094C6B] disabled:opacity-50"
            >
              {salaryMutation.isPending ? 'جاري الاعتماد...' : 'اعتماد مالي'}
            </button>
            <button
              type="button"
              disabled={wave3Busy || !payrollRunId || accrualPosted}
              onClick={() => void handleWave3PostAccrual()}
              className="h-9 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
            >
              ترحيل القيود وصرف الرواتب
            </button>
          </div>
          {payrollRunId ? (
            <p className="mt-2 text-right text-xs text-slate-500">مسير نشط: {payrollRunId}</p>
          ) : null}
        </section>

      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
    </HrPageChrome>
  );
}
