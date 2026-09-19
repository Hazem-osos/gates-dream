"use client";

import { HrPageChrome } from "@/components/hr/HrPageChrome";
import { DASH_PANEL } from "@/components/dashboard-primitives";
import { useState } from "react";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useApiMutation, useInvalidateQuery } from "@/lib/hooks/useApi";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import { hrMasterCodeRecordSchema, type HrMasterCodeRecordInput } from "@/lib/validation/hr.schema";

import type { ApiError } from '@/lib/api/types';

const inputCls =
  "h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

const wagePolicyDefaults: HrMasterCodeRecordInput = {
  code: '',
  arabicName: '',
  englishName: '',
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function WagePolicyPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HrMasterCodeRecordInput>({
    resolver: zodResolver(hrMasterCodeRecordSchema) as Resolver<HrMasterCodeRecordInput>,
    defaultValues: wagePolicyDefaults,
    mode: 'onTouched',
  });
  const [activeTab, setActiveTab] = useState<
    'additions' | 'absence' | 'housing' | 'endService' | 'vacations' | 'deductions'
  >('additions');

  const [vacationEligible, setVacationEligible] = useState<'yes' | 'no'>('yes');
  const [vacationEveryDays, setVacationEveryDays] = useState<number>(0);
  const [vacationPerDay, setVacationPerDay] = useState<number>(0);
  const [vacationNotes, setVacationNotes] = useState<string>("");

  const [endServiceEligible, setEndServiceEligible] = useState<'yes' | 'no'>('no');
  const [endServiceYears, setEndServiceYears] = useState<number>(0);
  const [endServiceDaysPerYear, setEndServiceDaysPerYear] = useState<number>(0);
  const [endServiceExtraDaysPerYear, setEndServiceExtraDaysPerYear] = useState<number>(0);
  const [endServiceUnusedLeave, setEndServiceUnusedLeave] = useState<boolean>(false);
  const [endServiceNoAbsence, setEndServiceNoAbsence] = useState<boolean>(false);
  const [endServiceNoPartialYear, setEndServiceNoPartialYear] = useState<boolean>(false);

  // Housing Allowance state
  const [housingEligible, setHousingEligible] = useState<'yes' | 'no'>('no');
  const [housingValueType, setHousingValueType] = useState<'percent' | 'amount'>('percent');
  const [housingAmount, setHousingAmount] = useState<number>(0);
  const [housingUnit, setHousingUnit] = useState<'مالية' | '%'>('مالية');
  const [housingPayoutEvery, setHousingPayoutEvery] = useState<'شهر' | 'ربع سنة' | 'نصف سنة' | 'سنة'>('شهر');

  // Wage policy mutation
  const wagePolicyMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/hr/wage-policies',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ سياسة الأجور بنجاح');
        invalidateQuery(['wage-policies']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const onSave: SubmitHandler<HrMasterCodeRecordInput> = (data) => {
    setError('');
    setSuccess('');
    wagePolicyMutation.mutate({
      code: data.code || undefined,
      arabicName: data.arabicName,
      englishName: data.englishName || undefined,
    });
  };

  const handleCancel = () => {
    reset(wagePolicyDefaults);
    setError('');
    setSuccess('');
  };

  const tabItems: { id: typeof activeTab; label: string }[] = [
    { id: 'additions', label: 'بيانات الإضافات' },
    { id: 'deductions', label: 'بيانات الإستقطاعات' },
    { id: 'absence', label: 'الغياب و الإضافي' },
    { id: 'housing', label: 'بدل السكن' },
    { id: 'endService', label: 'مكافأة نهاية الخدمة' },
    { id: 'vacations', label: 'الأجازات السنوية' },
  ];

  return (
    <HrPageChrome title="سياسة الأجور"
      onSave={handleSubmit(onSave)}
      onNew={handleCancel}
      savePending={wagePolicyMutation.isPending}
    >
        <div className={`${DASH_PANEL} p-5`}>
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              سياسة الأجور - {tabItems.find(t => t.id === activeTab)?.label}
            </h3>
            
            {/* Form Inputs */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm text-[#094C6B] mb-2">الكود</label>
                <input className={`${inputCls} ${errors.code ? 'border-red-400' : ''}`} placeholder="إدخل الكود" {...register('code')} />
              </div>
              <div>
                <label className="block text-sm text-[#094C6B] mb-2">الإسم العربي</label>
                <input
                  className={`${inputCls} ${errors.arabicName ? 'border-red-400' : ''}`}
                  placeholder="إدخل الإسم بالعربي"
                  {...register('arabicName')}
                />
                {errors.arabicName?.message ? <span className={errCls}>{String(errors.arabicName.message)}</span> : null}
              </div>
              <div>
                <label className="block text-sm text-[#094C6B] mb-2">الإسم الإنجليزي</label>
                <input className={inputCls} placeholder="إدخل الإسم الإنجليزي" {...register('englishName')} />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-xl shadow-lg p-2 border border-gray-100">
                <div className="flex space-x-1 space-x-reverse">
                  {tabItems.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-6 py-3 rounded-lg font-medium text-sm transition-all duration-300 transform hover:scale-105 ${
                        activeTab === tab.id
                          ? 'bg-[#0E78AA] text-white shadow-lg shadow-blue-200'
                          : 'text-gray-600 hover:text-[#0E79AA] hover:bg-blue-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content by tab */}
            {activeTab === 'additions' && (
              <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-sm">
                <table className="w-full text-center">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="py-2 px-3">م</th>
                      <th className="py-2 px-3">كود</th>
                      <th className="py-2 px-3">إسم الإضافة</th>
                      <th className="py-2 px-3">نوع الإضافة</th>
                      <th className="py-2 px-3">القيمة</th>
                      <th className="py-2 px-3">نوع القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1,2,3,4,5].map(i => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2 px-3">{i}</td>
                        <td className="py-2 px-3">كود</td>
                        <td className="py-2 px-3">إسم الإضافة</td>
                        <td className="py-2 px-3">نوع الإضافة</td>
                        <td className="py-2 px-3">القيمة</td>
                        <td className="py-2 px-3">نوع القيمة</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'deductions' && (
              <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-sm">
                <table className="w-full text-center">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="py-2 px-3">م</th>
                      <th className="py-2 px-3">كود</th>
                      <th className="py-2 px-3">إسم الإستقطاع</th>
                      <th className="py-2 px-3">نوع الإستقطاع </th>
                      <th className="py-2 px-3">القيمة</th>
                      <th className="py-2 px-3">نوع القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1,2,3,4,5].map(i => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2 px-3">{i}</td>
                        <td className="py-2 px-3">كود</td>
                        <td className="py-2 px-3">إسم الإستقطاع</td>
                        <td className="py-2 px-3">نوع الإستقطاع</td>
                        <td className="py-2 px-3">0.00</td>
                        <td className="py-2 px-3">نسبة/قيمة</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'absence' && (
              <div className="space-y-6">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  الغياب و الإضافي
                </h3>
                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left side - تشمل الإضافات التالية */}
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2">تشمل الإضافات التالية</label>
                    <textarea 
                      className={inputCls + ' w-full h-32 resize-none'} 
                      placeholder="اكتب الإضافات هنا..."
                    />
                  </div>

                  {/* Right side - Form inputs */}
                  <div className="space-y-4">
                    {/* لكل ساعة تأخير يخصم */}
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-[#094C6B] min-w-[200px]">لكل ساعة تأخير يخصم</label>
                      <input type="number" min={0} step={0.01} className="w-20 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] text-center" placeholder="0.00" />
                      
                      <div className="relative">
                        <select className={inputCls + ' w-32 pr-8'}>
                          <option value="مالية">مالية</option>
                          <option value="نسبة">نسبة</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* لكل يوم غياب يخصم */}
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-[#094C6B] min-w-[200px]">لكل يوم غياب يخصم</label>
                      <input type="number" min={0} step={0.01} className="w-20 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] text-center" placeholder="0.00" />
                      
                      <div className="relative">
                        <select className={inputCls + ' w-32 pr-8'}>
                          <option value="مالية">مالية</option>
                          <option value="نسبة">نسبة</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* لكل ساعة إضافي يضاف */}
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-[#094C6B] min-w-[200px]">لكل ساعة إضافي يضاف</label>
                      <input type="number" min={0} step={0.01} className="w-20 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] text-center" placeholder="0.00" />
                   
                      <div className="relative">
                        <select className={inputCls + ' w-32 pr-8'}>
                          <option value="مالية">مالية</option>
                          <option value="نسبة">نسبة</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* لكل يوم إضافي يضاف */}
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-[#094C6B] min-w-[200px]">لكل يوم إضافي يضاف</label>
                      <input type="number" min={0} step={0.01} className="w-20 py-2 border border-[#D6EAF3] bg-[#F6FBFD] focus:border-[#0E79AA] focus:ring-[#0E79AA] text-center" placeholder="0.00" />
               
                      <div className="relative">
                        <select className={inputCls + ' w-32 pr-8'}>
                          <option value="مالية">مالية</option>
                          <option value="نسبة">نسبة</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'endService' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2 flex items-center gap-4">
                    <label className="text-sm text-[#094C6B]">مكافأة نهاية الخدمة</label>
                    <div className="flex items-center gap-2">
                      <label className={`px-4 py-1 rounded-lg border ${endServiceEligible === 'yes' ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer`}>
                        <input type="radio" name="end-service-elig" className="hidden" checked={endServiceEligible==='yes'} onChange={()=>setEndServiceEligible('yes')} />
                        يستحق مكافأة نهاية خدمة
                      </label>
                      <label className={`px-4 py-1 rounded-lg border ${endServiceEligible === 'no' ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer`}>
                        <input type="radio" name="end-service-elig" className="hidden" checked={endServiceEligible==='no'} onChange={()=>setEndServiceEligible('no')} />
                        لا يستحق مكافأة نهاية خدمة
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div className="text-center">
                      <label className="block text-sm text-[#094C6B] mb-2">العدد سنوات</label>
                      <input type="number" min={0} step={1} value={endServiceYears} onChange={(e)=>setEndServiceYears(Number(e.target.value))} className={inputCls + ' py-3 text-center text-base'} />
                    </div>
                    <div className="text-center">
                      <label className="block text-sm text-[#094C6B] mb-2">يستحق عدد أيام عن كل سنة</label>
                      <input type="number" min={0} step={1} value={endServiceDaysPerYear} onChange={(e)=>setEndServiceDaysPerYear(Number(e.target.value))} className={inputCls + ' py-3 text-center text-base'} />
                    </div>
                    <div className="text-center">
                      <label className="block text-sm text-[#094C6B] mb-2">أكثر من هذه السنوات يستحق عدد أيام عن كل سنة</label>
                      <input type="number" min={0} step={1} value={endServiceExtraDaysPerYear} onChange={(e)=>setEndServiceExtraDaysPerYear(Number(e.target.value))} className={inputCls + ' py-3 text-center text-base'} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 items-start">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-[#094C6B] mb-1">تشمل الإضافات التالية</label>
                    <div className="space-y-2">
                      <label className={`px-4 py-2 rounded-lg border ${endServiceUnusedLeave ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={endServiceUnusedLeave} onChange={(e)=>setEndServiceUnusedLeave(e.target.checked)} className="hidden" />
                        <span>أيام الأجازت السنوية الغير مستهدمة تحول إلى نقود</span>
                      </label>
                      <label className={`px-4 py-2 rounded-lg border ${endServiceNoAbsence ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={endServiceNoAbsence} onChange={(e)=>setEndServiceNoAbsence(e.target.checked)} className="hidden" />
                        <span>لا تحسب أيام الغياب من مدة العمل الكلية</span>
                      </label>
                      <label className={`px-4 py-2 rounded-lg border ${endServiceNoPartialYear ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={endServiceNoPartialYear} onChange={(e)=>setEndServiceNoPartialYear(e.target.checked)} className="hidden" />
                        <span>أجزاء السنة لا تستحق مكافأة نهاية خدمة</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-1">تشمل الإضافات التالية</label>
                    <textarea 
                      className={inputCls + ' min-h-[120px] resize-none'} 
                      placeholder="اكتب الشروط والأحكام الإضافية لمكافأة نهاية الخدمة هنا..."
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vacations' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2 flex items-center gap-4">
                    <label className="text-sm text-[#094C6B]">الأجازات السنوية</label>
                    <div className="flex items-center gap-2">
                      <label className={`px-4 py-1 rounded-lg border ${vacationEligible === 'yes' ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer`}>
                        <input type="radio" name="vac-elig" className="hidden" checked={vacationEligible==='yes'} onChange={()=>setVacationEligible('yes')} />
                        يستحق إجازة سنوية
                      </label>
                      <label className={`px-4 py-1 rounded-lg border ${vacationEligible === 'no' ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer`}>
                        <input type="radio" name="vac-elig" className="hidden" checked={vacationEligible==='no'} onChange={()=>setVacationEligible('no')} />
                        لا يستحق إجازة سنوية
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm text-[#094C6B]">كل عدد أيام</label>
                      <input type="number" min={0} step={1} value={vacationEveryDays} onChange={(e)=>setVacationEveryDays(Number(e.target.value))} className={inputCls + ' text-sm py-1'} />
                    </div>
                    <div>
                      <label className="block text-sm text-[#094C6B]">يستحق عن يوم</label>
                      <input type="number" min={0} step={1} value={vacationPerDay} onChange={(e)=>setVacationPerDay(Number(e.target.value))} className={inputCls + ' text-sm py-1'} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#094C6B] mb-1">تشمل الإضافات التالية  </label>
                  <textarea className={inputCls + ' min-h-[96px]'} value={vacationNotes} onChange={(e)=>setVacationNotes(e.target.value)} placeholder="اكتب الملاحظات هنا" />
                </div>
              </div>
            )}

            {activeTab === 'housing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2 flex items-center gap-4">
                    <label className="text-sm text-[#094C6B]">بدل السكن</label>
                    <div className="flex items-center gap-2">
                      <label className={`px-4 py-1 rounded-lg border ${housingEligible === 'yes' ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer`}>
                        <input type="radio" name="housing-elig" className="hidden" checked={housingEligible==='yes'} onChange={()=>setHousingEligible('yes')} />
                        يستحق بدل سكن
                      </label>
                      <label className={`px-4 py-1 rounded-lg border ${housingEligible === 'no' ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer`}>
                        <input type="radio" name="housing-elig" className="hidden" checked={housingEligible==='no'} onChange={()=>setHousingEligible('no')} />
                        لا يستحق بدل سكن
                      </label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                      <div className="md:col-span-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <label className={`px-3 py-1 rounded-lg border ${housingValueType === 'percent' ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer`}>
                            <input type="radio" name="housing-type" className="hidden" checked={housingValueType==='percent'} onChange={()=>setHousingValueType('percent')} />
                            نسبة
                          </label>
                          <label className={`px-3 py-1 rounded-lg border ${housingValueType === 'amount' ? 'bg-[#0E79AA] text-white border-[#0E79AA]' : 'bg-[#F6FBFD] text-[#094C6B] border-[#D6EAF3]'} cursor-pointer`}>
                            <input type="radio" name="housing-type" className="hidden" checked={housingValueType==='amount'} onChange={()=>setHousingValueType('amount')} />
                            قيمة
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="block text-sm text-[#094C6B]">يأخذ</label>
                          <input type="number" min={0} step={0.01} value={housingAmount} onChange={(e)=>setHousingAmount(Number(e.target.value))} className={inputCls + ' text-sm py-1 w-28 text-center'} placeholder="0.00" />
                          <select className={inputCls + ' py-1 text-sm w-28'} value={housingUnit} onChange={(e)=>setHousingUnit(e.target.value as 'مالية' | '%')}>
                            <option value="%">%</option>
                            <option value="مالية">مالية</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-1">يدفع كل</label>
                    <select className={inputCls + ' py-1 text-sm'} value={housingPayoutEvery} onChange={(e)=>setHousingPayoutEvery(e.target.value as 'شهر' | 'ربع سنة' | 'نصف سنة' | 'سنة')}>
                      <option>شهر</option>
                      <option>ربع سنة</option>
                      <option>نصف سنة</option>
                      <option>سنة</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#094C6B] mb-1">تشمل الإضافات التالية</label>
                  <textarea 
                    className={inputCls + ' min-h-[120px] resize-none'} 
                    placeholder="اكتب الشروط والأحكام الإضافية لبدل السكن هنا..."
                  />
                </div>
              </div>
            )}

            {error && <ErrorToast message={error} onClose={() => setError('')} />}
            {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
        </div>
    </HrPageChrome>
  );
}
