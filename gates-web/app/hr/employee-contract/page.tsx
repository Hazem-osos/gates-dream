'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import Image from 'next/image';
import {
  employeeContractFormSchema,
  type EmployeeContractFormInput,
} from '@/lib/validation/hr.schema';

import type { ApiError } from '@/lib/api/types';

const contractFormDefaults: EmployeeContractFormInput = {
  serialNumber: '',
  employee: '',
  contractStartDate: '',
  contractEndDate: '',
  wagePolicy: '',
  basicSalary: '',
  insuranceSalary: '',
  insurancePercentage: '',
  paymentMethod: 'fund',
  employeeResponsibility: '',
  companyResponsibility: '',
  leaveBalance: '',
  department: '',
  section: '',
  jobCadre: '',
  jobTitle: '',
  city: '',
  workBranch: '',
  salaryBranch: '',
  costCenter: '',
  autoRenewal: false,
  attendancePolicy: false,
  incomeTax: false,
  generalNotes: '',
};

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

interface WagePolicy {
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

export default function EmployeeContractPage() {
  const invalidateQuery = useInvalidateQuery();
  const [activeTab, setActiveTab] = useState('general');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedJobTitleId, setSelectedJobTitleId] = useState('');
  const [selectedJobCadreId, setSelectedJobCadreId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedWagePolicyId, setSelectedWagePolicyId] = useState('');
  const [selectedCostCenterId, setSelectedCostCenterId] = useState('');
  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [showDepartmentSearch, setShowDepartmentSearch] = useState(false);
  const [showJobTitleSearch, setShowJobTitleSearch] = useState(false);
  const [showJobCadreSearch, setShowJobCadreSearch] = useState(false);
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [showWagePolicySearch, setShowWagePolicySearch] = useState(false);
  const [showCostCenterSearch, setShowCostCenterSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const formDefaults = useMemo(() => ({ ...contractFormDefaults }), []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EmployeeContractFormInput>({
    resolver: zodResolver(employeeContractFormSchema),
    defaultValues: formDefaults,
  });

  const paymentMethod = watch('paymentMethod');
  const autoRenewal = watch('autoRenewal');
  const attendancePolicy = watch('attendancePolicy');
  const incomeTax = watch('incomeTax');

  // Fetch data
  const { data: employeesResponse } = useApiQuery<Employee[]>(
    ['employees'],
    '/hr/employees',
    { limit: 1000, isActive: true }
  );
  const employees = employeesResponse?.data || [];

  useApiQuery<Department[]>(
    ['departments'],
    '/hr/departments',
    { limit: 1000, isActive: true }
  );
  useApiQuery<JobTitle[]>(
    ['job-titles'],
    '/hr/job-titles',
    { limit: 1000, isActive: true }
  );

  useApiQuery<JobCadre[]>(
    ['job-cadres'],
    '/hr/job-cadres',
    { limit: 1000, isActive: true }
  );

  useApiQuery<City[]>(
    ['cities'],
    '/hr/cities',
    { limit: 1000, isActive: true }
  );

  useApiQuery<WagePolicy[]>(
    ['wage-policies'],
    '/hr/wage-policies',
    { limit: 1000, isActive: true }
  );

  useApiQuery<CostCenter[]>(
    ['cost-centers'],
    '/accounting/cost-centers',
    { limit: 1000, isActive: true }
  );

  // Contract mutation
  const contractMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/hr/employee-contracts',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ العقد بنجاح');
        invalidateQuery(['employee-contracts']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setValue('contractStartDate', today);
    setValue('contractEndDate', today);
  }, [setValue]);

  const submitContract = (data: EmployeeContractFormInput) => {
    setError('');
    setSuccess('');

    if (!selectedEmployeeId) {
      setError('يرجى اختيار الموظف');
      return;
    }

    const requestBody: Record<string, unknown> = {
      employeeId: selectedEmployeeId,
      serial: data.serialNumber || undefined,
      contractStartDate: new Date(data.contractStartDate).toISOString(),
      contractEndDate: data.contractEndDate ? new Date(data.contractEndDate).toISOString() : null,
      wagePolicyId: selectedWagePolicyId || null,
      basicSalary: data.basicSalary ? parseFloat(data.basicSalary) : null,
      insuranceSalary: data.insuranceSalary ? parseFloat(data.insuranceSalary) : null,
      insurancePercentage: data.insurancePercentage ? parseFloat(data.insurancePercentage) : null,
      paymentMethod: data.paymentMethod || null,
      employeeResponsibility: data.employeeResponsibility ? parseFloat(data.employeeResponsibility) : null,
      companyResponsibility: data.companyResponsibility ? parseFloat(data.companyResponsibility) : null,
      leaveBalance: data.leaveBalance ? parseFloat(data.leaveBalance) : null,
      departmentId: selectedDepartmentId || null,
      sectionId: data.section || null,
      jobCadreId: selectedJobCadreId || null,
      jobTitleId: selectedJobTitleId || null,
      cityId: selectedCityId || null,
      workBranchId: data.workBranch || null,
      salaryBranchId: data.salaryBranch || null,
      costCenterId: selectedCostCenterId || null,
      autoRenewal: data.autoRenewal,
      attendancePolicy: data.attendancePolicy,
      incomeTax: data.incomeTax,
      generalNotes: data.generalNotes || null,
    };

    contractMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    reset(formDefaults);
    const today = new Date().toISOString().split('T')[0];
    setValue('contractStartDate', today);
    setValue('contractEndDate', today);
    setSelectedEmployeeId('');
    setSelectedDepartmentId('');
    setSelectedJobTitleId('');
    setSelectedJobCadreId('');
    setSelectedCityId('');
    setSelectedWagePolicyId('');
    setSelectedCostCenterId('');
    setError('');
    setSuccess('');
  };

  const inputCls =
    'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';
  const fieldBorder = (name: keyof EmployeeContractFormInput) =>
    errors[name] ? 'border-red-400' : '';

  const horizontalTabs = [
    { key: 'general', label: 'عامة' },
    { key: 'additions', label: 'بيانات الإضافات' },
    { key: 'deductions', label: 'بيانات الإستقطاعات' },
    { key: 'leaves', label: 'الأجازات السنوية' },
    { key: 'endService', label: 'مكافأة نهاية الخدمة' },
    { key: 'housing', label: 'بدل السكن' },
    { key: 'overtime', label: 'الغياب و الإضافي' },
  ];

  return (
    <>
    <HrPageChrome title="تعاقد موظف">
      <div className={`${DASH_PANEL} p-5`}>
           
            {/* Form Fields BEFORE Tabs */}
            <div className="mb-8 space-y-6">
              {/* Top Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">المسلسل</label>
                  <input
                    type="text"
                    {...register('serialNumber')}
                    className={`${inputCls} ${fieldBorder('serialNumber')}`}
                    placeholder="إدخل رقم المسلسل"
                  />
                  {errors.serialNumber && (
                    <p className="text-xs text-red-600 mt-1">{errors.serialNumber.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-[#094C6B] mb-2">الموظف</label>
                  <div className="flex items-center gap-2 relative">
                    <input
                      type="text"
                      {...register('employee')}
                      readOnly
                      onClick={() => {
                        setShowEmployeeSearch(true);
                        setSearchTerm('');
                      }}
                      className={`flex-1 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg cursor-pointer ${fieldBorder('employee')}`}
                      placeholder="اختر الموظف"
                    />
                    <button
                      type="button"
                      className="p-2 bg-[#0E78AA] rounded-lg border border-[#D6EAF3] hover:bg-[#0A5F8A]"
                      onClick={() => {
                        setShowEmployeeSearch(true);
                        setSearchTerm('');
                      }}
                    >
                      <Image src="/magnifying-glass-1.svg" alt="بحث" width={20} height={20} />
                    </button>
                    
                    {showEmployeeSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#D6EAF3] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                        <div className="p-2 border-b border-[#D6EAF3]">
                          <input
                            type="text"
                            className="w-full p-2 border border-[#D6EAF3] rounded-lg focus:border-[#0E78AA] focus:outline-none text-right"
                            placeholder="ابحث عن الموظف..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {employees.filter((emp: Employee) =>
                            emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            emp.arabicName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (emp.englishName && emp.englishName.toLowerCase().includes(searchTerm.toLowerCase()))
                          ).map((emp: Employee) => (
                            <div
                              key={emp.id}
                              className="p-2 hover:bg-[#F6FBFD] cursor-pointer border-b border-[#D6EAF3] last:border-b-0"
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setValue('employee', `${emp.code} - ${emp.arabicName}`, {
                                  shouldValidate: true,
                                });
                                setShowEmployeeSearch(false);
                                setSearchTerm('');
                              }}
                            >
                              <div className="text-sm font-medium text-[#222]">{emp.code}</div>
                              <div className="text-xs text-gray-600">{emp.arabicName}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.employee && (
                    <p className="text-xs text-red-600 mt-1">{errors.employee.message}</p>
                  )}
                </div>
              </div>

              {/* Contract Dates Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">بداية العقد</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            {...register('contractStartDate')}
                            className={`${inputCls} ${fieldBorder('contractStartDate')}`}
                          />
                          <label className="text-sm text-[#094C6B]">هجري</label>
                          <input
                            type="date"
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-[#094C6B] mb-2">نهاية العقد</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            {...register('contractEndDate')}
                            className={`${inputCls} ${fieldBorder('contractEndDate')}`}
                          />
                          <label className="text-sm text-[#094C6B]">هجري</label>
                          <input
                            type="date"
                            className={inputCls}
                          />
                        </div>
                      </div>
                      {(errors.contractStartDate || errors.contractEndDate) && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.contractStartDate?.message || errors.contractEndDate?.message}
                        </p>
                      )}
              </div>

              {/* Wage Policy Row */}
              <div>
                <label className="block text-sm text-[#094C6B] mb-2">سياسة الأجور</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    {...register('wagePolicy')}
                    readOnly
                    className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('wagePolicy')}`}
                  />
                  <input
                    type="text"
                    className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                    placeholder=""
                  />
                </div>
              </div>
            </div>

            {/* Horizontal Tabs */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2 border-b border-[#D6EAF3]">
                {horizontalTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-[#0E79AA] text-white border-b-2 border-[#0E79AA]'
                        : 'bg-[#F6FBFD] text-[#094C6B] hover:bg-[#E6F0F7]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

                                    {/* Tab Content */}
                        {activeTab === 'general' && (
                          <div className="space-y-8">
                            {/* Two Column Layout for General Tab */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              {/* Left Column (was Right) */}
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">الراتب الأساسي</label>
                                  <input
                                    type="text"
                                    {...register('basicSalary')}
                                    className={`${inputCls} ${fieldBorder('basicSalary')}`}
                                    placeholder="إدخل الراتب الأساسي"
                                  />
                                  {errors.basicSalary && (
                                    <p className="text-xs text-red-600 mt-1">{errors.basicSalary.message}</p>
                                  )}
                                </div>

                                {/* Payment Method */}
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">طريقة الدفع</label>
                                  <div className="flex gap-4">
                                    <button
                                      type="button"
                                      className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                        paymentMethod === 'fund'
                                          ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                          : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                      }`}
                                      onClick={() =>
                                        setValue('paymentMethod', 'fund', { shouldValidate: true, shouldDirty: true })
                                      }
                                    >
                                      صندوق
                                    </button>
                                    <button
                                      type="button"
                                      className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                        paymentMethod === 'bank'
                                          ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                          : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                      }`}
                                      onClick={() =>
                                        setValue('paymentMethod', 'bank', { shouldValidate: true, shouldDirty: true })
                                      }
                                    >
                                      بنك
                                    </button>
                                  </div>
                                  {errors.paymentMethod && (
                                    <p className="text-xs text-red-600 mt-1">{errors.paymentMethod.message}</p>
                                  )}
                                </div>

                                {/* Left Column Form Fields (was Right) */}
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">الإدارة</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        {...register('department')}
                                        readOnly
                                        className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('department')}`}
                                      />
                                      <input
                                        type="text"
                                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">القسم</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        {...register('section')}
                                        readOnly
                                        className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('section')}`}
                                      />
                                      <input
                                        type="text"
                                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">الكادر الوظيفي</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        {...register('jobCadre')}
                                        readOnly
                                        className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('jobCadre')}`}
                                      />
                                      <input
                                        type="text"
                                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">الوظيفة</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        {...register('jobTitle')}
                                        readOnly
                                        className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('jobTitle')}`}
                                      />
                                      <input
                                        type="text"
                                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">المدينة</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        {...register('city')}
                                        readOnly
                                        className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('city')}`}
                                      />
                                      <input
                                        type="text"
                                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">فرع العمل</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        {...register('workBranch')}
                                        readOnly
                                        className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('workBranch')}`}
                                      />
                                      <input
                                        type="text"
                                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">فرع الراتب</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        {...register('salaryBranch')}
                                        readOnly
                                        className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('salaryBranch')}`}
                                      />
                                      <input
                                        type="text"
                                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">مركز التكلفة</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        {...register('costCenter')}
                                        readOnly
                                        className={`w-32 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg ${fieldBorder('costCenter')}`}
                                      />
                                      <input
                                        type="text"
                                        className="w-32 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column (was Left) */}
                              <div className="border border-[#D6EAF3] rounded-lg p-4 bg-[#F6FBFD]">
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">راتب التأمين</label>
                                    <input
                                      type="text"
                                      {...register('insuranceSalary')}
                                      className={`${inputCls} ${fieldBorder('insuranceSalary')}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">نسبة التأمين</label>
                                    <input
                                      type="text"
                                      {...register('insurancePercentage')}
                                      className={`${inputCls} ${fieldBorder('insurancePercentage')}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">تحمل الموظف</label>
                                    <input
                                      type="text"
                                      {...register('employeeResponsibility')}
                                      className={`${inputCls} ${fieldBorder('employeeResponsibility')}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">تحمل الشركة</label>
                                    <input
                                      type="text"
                                      {...register('companyResponsibility')}
                                      className={`${inputCls} ${fieldBorder('companyResponsibility')}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm text-[#094C6B] mb-2">رصيد الأجازات</label>
                                    <input
                                      type="text"
                                      {...register('leaveBalance')}
                                      className={`${inputCls} ${fieldBorder('leaveBalance')}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Checkboxes */}
                            <div className="space-y-3">
                              <div
                                role="button"
                                tabIndex={0}
                                className="flex items-center gap-3 p-3 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] hover:bg-[#E6F0F7] transition-colors cursor-pointer"
                                onClick={() =>
                                  setValue('autoRenewal', !autoRenewal, { shouldValidate: true, shouldDirty: true })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setValue('autoRenewal', !autoRenewal, { shouldValidate: true, shouldDirty: true });
                                  }
                                }}
                              >
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                  autoRenewal 
                                    ? 'bg-[#0E79AA] border-[#0E79AA] shadow-lg' 
                                    : 'bg-white border-[#D6EAF3]'
                                }`}>
                                  {autoRenewal && (
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-[#094C6B] font-medium">العقد لا يجدد تلقائيا</span>
                              </div>
                              
                              <div
                                role="button"
                                tabIndex={0}
                                className="flex items-center gap-3 p-3 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] hover:bg-[#E6F0F7] transition-colors cursor-pointer"
                                onClick={() =>
                                  setValue('attendancePolicy', !attendancePolicy, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setValue('attendancePolicy', !attendancePolicy, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    });
                                  }
                                }}
                              >
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                  attendancePolicy 
                                    ? 'bg-[#0E79AA] border-[#0E79AA] shadow-lg' 
                                    : 'bg-white border-[#D6EAF3]'
                                }`}>
                                  {attendancePolicy && (
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-[#094C6B] font-medium">لا يخضع لسياسة الحضور و الإنصراف</span>
                              </div>
                              
                              <div
                                role="button"
                                tabIndex={0}
                                className="flex items-center gap-3 p-3 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] hover:bg-[#E6F0F7] transition-colors cursor-pointer"
                                onClick={() =>
                                  setValue('incomeTax', !incomeTax, { shouldValidate: true, shouldDirty: true })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setValue('incomeTax', !incomeTax, { shouldValidate: true, shouldDirty: true });
                                  }
                                }}
                              >
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                  incomeTax 
                                    ? 'bg-[#0E79AA] border-[#0E79AA] shadow-lg' 
                                    : 'bg-white border-[#D6EAF3]'
                                }`}>
                                  {incomeTax && (
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L6 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-[#094C6B] font-medium">لا يخضع لضريبة كسب العمل</span>
                              </div>
                            </div>

                            {/* General Notes */}
                            <div>
                              <label className="block text-sm text-[#094C6B] mb-2">ملاحظات عامة</label>
                              <textarea
                                {...register('generalNotes')}
                                className={`${inputCls} h-32 resize-none ${fieldBorder('generalNotes')}`}
                                placeholder="أدخل الملاحظات العامة هنا..."
                              />
                            </div>
                          </div>
                        )}

                        {activeTab === 'additions' && (
                          <div className="space-y-6">
                            {/* Additions Data Table */}
                            <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-md">
                              <table className="w-full text-center border-separate border-spacing-0">
                                <thead>
                                  <tr>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">م</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">كود</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">إسم الإضافة</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">نوع الإضافة</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">القيمة</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">نوع القيمة</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">القيمة المالية</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[1, 2, 3, 4, 5].map((row) => (
                                    <tr key={row} className="border-b border-slate-100 hover:bg-slate-50/80">
                                      <td className="py-3 px-4 text-black">{row}</td>
                                      <td className="py-3 px-4 text-black"></td>
                                      <td className="py-3 px-4 text-black"></td>
                                      <td className="py-3 px-4 text-black"></td>
                                      <td className="py-3 px-4 text-black"></td>
                                      <td className="py-3 px-4 text-black"></td>
                                      <td className="py-3 px-4 text-black"></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {activeTab === 'leaves' && (
                          <div className="space-y-6">
                            {/* Leave Entitlement Section */}
                            <div className="space-y-4">
                              <h3 className="mb-4 text-sm font-semibold text-slate-900">الأجازات السنوية</h3>
                              
                              {/* Leave Entitlement Radio Buttons */}
                              <div className="space-y-3">
                                <div className="flex gap-4">
                                  <div
                                    className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      true // defaultChecked
                                        ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                        : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                    }`}
                                    onClick={() => {
                                      // Handle selection logic here
                                    }}
                                  >
                                    يستحق أجازة سنوية
                                  </div>
                                  <div
                                    className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      false // not selected
                                        ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                        : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                    }`}
                                    onClick={() => {
                                      // Handle selection logic here
                                    }}
                                  >
                                    لا يستحق أجازة سنوية
                                  </div>
                                </div>
                              </div>

                              {/* Leave Days Inputs */}
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">يستحق عدد أيام</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">كل عدد أيام</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Tickets Section */}
                            <div className="space-y-4">
                              <h4 className="text-md font-semibold text-[#094C6B]">التذاكر</h4>
                              
                              {/* Ticket Search */}
                              <div>
                                <label className="block text-sm text-[#094C6B] mb-2">التذاكر</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    defaultValue="1212378971212"
                                    readOnly
                                    className="flex-1 py-2 border border-[#D6EAF3] bg-gray-100 focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg"
                                  />
                                  <button className="p-2 text-[#0E79AA] hover:bg-[#F6FBFD] rounded">🔍</button>
                                </div>
                              </div>

                              {/* Number of Tickets */}
                              <div>
                                <label className="block text-sm text-[#094C6B] mb-2">عدد التذاكر</label>
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-xs text-[#094C6B] mb-1">تذكرة كاملة</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      defaultValue="0.00"
                                      className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-[#094C6B] mb-1">نصف تذكرة</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      defaultValue="0.00"
                                      className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-[#094C6B] mb-1">تذكرة رضع</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      defaultValue="0.00"
                                      className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Additional Information */}
                            <div>
                              <label className="block text-sm text-[#094C6B] mb-2">تشمل الإضافات التالية</label>
                              <textarea
                                className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm h-24 resize-none"
                                placeholder="أدخل الإضافات المطلوبة..."
                              />
                            </div>

                            {/* Action Buttons */}
                           
                          </div>
                        )}

                                                {activeTab === 'deductions' && (
                          <div className="space-y-6">
                            {/* Deductions Data Table */}
                            <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-md">
                              <table className="w-full text-center border-separate border-spacing-0">
                                <thead>
                                  <tr>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">م</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">كود</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">إسم الإستقطاع</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">نوع الإستقطاع</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">القيمة</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">نوع القيمة</th>
                                    <th className="bg-slate-50/80 text-slate-600 py-3 px-4">القيمة المالية</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[1, 2, 3, 4, 5].map((row) => (
                                    <tr key={row} className="border-b border-slate-100 hover:bg-slate-50/80">
                                      <td className="py-3 px-4 text-black">{row}</td>
                                      <td className="py-3 px-4 text-black">كود</td>
                                      <td className="py-3 px-4 text-black">إسم الإستقطاع</td>
                                      <td className="py-3 px-4 text-black">نوع الإستقطاع</td>
                                      <td className="py-3 px-4 text-black">القيمة</td>
                                      <td className="py-3 px-4 text-black">نوع القيمة</td>
                                      <td className="py-3 px-4 text-black">القيمة المالية</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {activeTab === 'endService' && (
                          <div className="space-y-6">
                            {/* End of Service Benefit Section */}
                            <div className="space-y-4">
                              <h3 className="mb-4 text-sm font-semibold text-slate-900">مكافأة نهاية الخدمة</h3>
                              
                              {/* Benefit Entitlement Radio Buttons */}
                              <div className="space-y-3">
                                <div className="flex gap-4">
                                  <div
                                    className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      false // not selected
                                        ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                        : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                    }`}
                                    onClick={() => {
                                      // Handle selection logic here
                                    }}
                                  >
                                    لا يستحق مكافأة نهاية خدمة
                                  </div>
                                  <div
                                    className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      true // selected
                                        ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                        : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                    }`}
                                    onClick={() => {
                                      // Handle selection logic here
                                    }}
                                  >
                                    يستحق مكافأة نهاية خدمة
                                  </div>
                                </div>
                              </div>

                              {/* Calculation Inputs */}
                              <div className="grid grid-cols-3 gap-6">
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">لعدد سنوات</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">يستحق عدد أيام عن كل سنة</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">أكثر من هذه السنوات يستحق عدد أيام عن كل سنة</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Policy Checkboxes */}
                            <div className="space-y-3">
                              <h4 className="text-md font-semibold text-[#094C6B]">سياسة المكافأة</h4>
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] hover:bg-[#E6F0F7] transition-colors cursor-pointer">
                                  <div className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all bg-[#0E79AA] border-[#0E79AA] shadow-lg">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <span className="text-[#094C6B] font-medium">أيام الأجازت السنوية الغير مستهدمة تحول الى نقود</span>
                                </div>
                                
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] hover:bg-[#E6F0F7] transition-colors cursor-pointer">
                                  <div className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all bg-[#0E79AA] border-[#0E79AA] shadow-lg">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <span className="text-[#094C6B] font-medium">لا تحسب أيام الغياب من مدة العمل الكلية</span>
                                </div>
                                
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] hover:bg-[#E6F0F7] transition-colors cursor-pointer">
                                  <div className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all bg-[#0E79AA] border-[#0E79AA] shadow-lg">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <span className="text-[#094C6B] font-medium">أجزاء السنة لا تستحق مكافأة نهاية خدمة</span>
                                </div>
                              </div>
                            </div>

                            {/* Additional Information */}
                            <div>
                              <label className="block text-sm text-[#094C6B] mb-2">تشمل الإضافات التالية</label>
                              <textarea
                                className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm h-24 resize-none"
                                placeholder="أدخل الإضافات المطلوبة..."
                              />
                            </div>

                            {/* Action Buttons */}
                           
                          </div>
                        )}

                                                {activeTab === 'housing' && (
                          <div className="space-y-6">
                            {/* Housing Allowance Section */}
                            <div className="space-y-4">
                              <h3 className="mb-4 text-sm font-semibold text-slate-900">بدل السكن</h3>
                              
                              {/* Housing Allowance Entitlement Radio Buttons */}
                              <div className="space-y-3">
                                <div className="flex gap-4">
                                  <div
                                    className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      false // not selected
                                        ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                        : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                    }`}
                                    onClick={() => {
                                      // Handle selection logic here
                                    }}
                                  >
                                    لا يستحق بدل سكن
                                  </div>
                                  <div
                                    className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      true // selected
                                        ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                        : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                    }`}
                                    onClick={() => {
                                      // Handle selection logic here
                                    }}
                                  >
                                    يستحق بدل سكن
                                  </div>
                                </div>
                              </div>

                              {/* Additional Allowance Type */}
                              <div className="space-y-3">
                                <h4 className="text-md font-semibold text-[#094C6B]">تشمل الإضافات التالية</h4>
                                <div className="flex gap-4">
                                  <div
                                    className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      false // not selected
                                        ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                        : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                    }`}
                                    onClick={() => {
                                      // Handle selection logic here
                                    }}
                                  >
                                    نسبة
                                  </div>
                                  <div
                                    className={`px-6 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      true // selected
                                        ? 'bg-[#0E79AA] text-white border-[#0E79AA] shadow-lg'
                                        : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3] hover:border-[#0E79AA] hover:bg-[#E6F0F7]'
                                    }`}
                                    onClick={() => {
                                      // Handle selection logic here
                                    }}
                                  >
                                    قيمة
                                  </div>
                                </div>
                              </div>

                              {/* Financial and Payment Settings */}
                              <div className="grid grid-cols-3 gap-6">
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">يأخذ</label>
                                  <input type="number" className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm " placeholder="0.00" 
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">يأخذ</label>
                                  <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">
                                    <option value="">اختر...</option>
                                    <option value="option1">خيار 1</option>
                                    <option value="option2">خيار 2</option>
                                    <option value="option3">خيار 3</option>
                                  </select>
                                </div>
                               
                                <div>
                                  <label className="block text-sm text-[#094C6B] mb-2">تدفع كل</label>
                                  <select defaultValue="month" className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">
                                    <option value="">اختر...</option>
                                    <option value="month">شهر</option>
                                    <option value="quarter">ربع سنة</option>
                                    <option value="year">سنة</option>
                                  </select>
                                </div>
                              </div>

                              {/* Additional Information */}
                              <div>
                                <label className="block text-sm text-[#094C6B] mb-2">تشمل الإضافات التالية</label>
                                <textarea
                                  className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm h-24 resize-none"
                                  placeholder="أدخل الإضافات المطلوبة..."
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'overtime' && (
                          <div className="space-y-6">
                            {/* Absence and Additions Section */}
                            <div className="space-y-4">
                              <h3 className="mb-4 text-sm font-semibold text-slate-900">الغياب و الإضافي</h3>
                              
                            

                              {/* Absence and Additions Input Fields */}
                              <div className="space-y-4">
                                {/* Row 1: Delay Deduction */}
                                <div className="flex items-center gap-4">
                                  <label className="text-sm text-[#094C6B] min-w-[200px]">لكل ساعة تأخير يخصم</label>
                                  <select defaultValue="financial" className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg min-w-[120px]">
                                    <option value="financial">مالية</option>
                                    <option value="percentage">نسبة</option>
                                    <option value="days">أيام</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg min-w-[100px]"
                                  />
                                </div>

                                {/* Row 2: Absence Deduction */}
                                <div className="flex items-center gap-4">
                                  <label className="text-sm text-[#094C6B] min-w-[200px]">لكل يوم غياب يخصم</label>
                                  <select defaultValue="financial" className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg min-w-[120px]">
                                    <option value="financial">مالية</option>
                                    <option value="percentage">نسبة</option>
                                    <option value="days">أيام</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg min-w-[100px]"
                                  />
                                </div>

                                {/* Row 3: Extra Hour Addition */}
                                <div className="flex items-center gap-4">
                                  <label className="text-sm text-[#094C6B] min-w-[200px]">لكل ساعة إضافي يضاف</label>
                                  <select defaultValue="financial" className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg min-w-[120px]">
                                    <option value="financial">مالية</option>
                                    <option value="percentage">نسبة</option>
                                    <option value="days">أيام</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg min-w-[100px]"
                                  />
                                </div>

                                {/* Row 4: Extra Day Addition */}
                                <div className="flex items-center gap-4">
                                  <label className="text-sm text-[#094C6B] min-w-[200px]">لكل يوم إضافي يضاف</label>
                                  <select defaultValue="financial" className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg min-w-[120px]">
                                    <option value="financial">مالية</option>
                                    <option value="percentage">نسبة</option>
                                    <option value="days">أيام</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    className="py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] rounded-lg min-w-[100px]"
                                  />
                                </div>
                              </div>
  {/* Additional Information Textarea */}
  <div>
                                <label className="block text-sm text-[#094C6B] mb-2">تشمل الإضافات التالية</label>
                                <textarea
                                  className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm h-24 resize-none"
                                  placeholder="أدخل الإضافات المطلوبة..."
                                />
                              </div>
                       
                            </div>
                          </div>
                        )}

          
          {error && <ErrorToast message={error} onClose={() => setError('')} />}
          {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
          
          <div className="flex justify-end mt-6">
            <ActionButtons
              onSave={() => void handleSubmit(submitContract)()}
              onCancel={handleCancel}
              saveText={contractMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            />
          </div>
      </div>
    </HrPageChrome>
      
      {(showEmployeeSearch || showDepartmentSearch || showJobTitleSearch || showJobCadreSearch || showCitySearch || showWagePolicySearch || showCostCenterSearch) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowEmployeeSearch(false);
            setShowDepartmentSearch(false);
            setShowJobTitleSearch(false);
            setShowJobCadreSearch(false);
            setShowCitySearch(false);
            setShowWagePolicySearch(false);
            setShowCostCenterSearch(false);
          }}
        />
      )}
    </>
  );
}
