"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { transactionModelFormSchema, type TransactionModelFormInput } from '@/lib/validation/hr.schema';

const defaults: TransactionModelFormInput = {
  code: '',
  englishName: '',
  arabicName: '',
  boldFont: false,
  fontSize: '12',
  fontFamily: 'Time New',
  content: '',
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export default function TransactionModelsPage() {
  useBackendReachability();

  const [currentPage] = useState(1);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TransactionModelFormInput>({
    resolver: zodResolver(transactionModelFormSchema) as Resolver<TransactionModelFormInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const boldFont = watch('boldFont');
  const fontSize = watch('fontSize');
  const fontFamily = watch('fontFamily');

  const onSave: SubmitHandler<TransactionModelFormInput> = (values) => {
    console.info('[transaction-models]', values);
  };

  const input =
    'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';

  return (
    <HrPageChrome title="تعريف نماذج المعاملات"
      onSave={handleSubmit(onSave)}
      onNew={() => reset(defaults)}
    >
      <div className={`${DASH_PANEL} p-5`} style={{ direction: 'rtl' }}>
            <div className="mb-8 space-y-6">
              <div className="text-right">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">بيانات أساسية</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2 font-semibold">الكود</label>
                    <input type="text" className={input} placeholder="إدخل رقم الكود" {...register('code')} />
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-2 font-semibold">الإسم الإنجليزي</label>
                    <input type="text" className={input} placeholder="إدخل الإسم الإنجليزي" {...register('englishName')} />
                  </div>
                </div>
                <div className="lg:order-1">
                  <label className="block text-sm text-[#094C6B] mb-2 font-semibold">الإسم العربي</label>
                  <input
                    type="text"
                    className={`${input} ${errors.arabicName ? 'border-red-400' : ''}`}
                    placeholder="إدخل الإسم بالعربي"
                    {...register('arabicName')}
                  />
                  {errors.arabicName?.message ? <span className={errCls}>{String(errors.arabicName.message)}</span> : null}
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="text-right mb-4">
                <h3 className="text-md font-semibold text-[#094C6B]">إعتماد النموذج حسب الترتيب</h3>
              </div>
              <div className="bg-white border border-[#D6EAF3] rounded-lg p-4">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="flex items-center gap-4">
                      <label className="text-sm text-[#094C6B] font-semibold min-w-[60px]">موظف 1</label>
                      <input
                        type="text"
                        defaultValue="1212378971212"
                        className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B]"
                        placeholder="رقم الموظف"
                      />
                      <select className="flex-1 px-3 py-2 border border-[#D6EAF3] bg-[#F6FBFD] rounded-lg text-[#094C6B]">
                        <option value="الخزينة الرئيسية">الخزينة الرئيسية</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="text-right mb-4">
                <h3 className="text-md font-semibold text-[#094C6B]">ببيانات النموذج</h3>
              </div>
              <div className="bg-white border border-[#D6EAF3] rounded-lg p-4">
                <div className="flex flex-wrap gap-4 mb-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 text-[#0E79AA] border-[#D6EAF3] rounded focus:ring-[#0E79AA]" {...register('boldFont')} />
                    <span className="text-sm text-[#094C6B]">خط سميك</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#094C6B]">الحجم:</span>
                    <select
                      className="px-2 py-1 border border-[#D6EAF3] bg-[#F6FBFD] rounded text-[#094C6B] text-sm"
                      {...register('fontSize')}
                    >
                      {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map((size) => (
                        <option key={size} value={String(size)}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#094C6B]">الخط:</span>
                    <select className="px-2 py-1 border border-[#D6EAF3] bg-[#F6FBFD] rounded text-[#094C6B] text-sm" {...register('fontFamily')}>
                      <option value="Time New">Time New</option>
                      <option value="Arial">Arial</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Tahoma">Tahoma</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                  </div>
                </div>
                <textarea
                  rows={8}
                  className={input + ' resize-none'}
                  placeholder="أدخل محتوى النموذج هنا..."
                  style={{
                    fontFamily: fontFamily || 'Time New',
                    fontSize: `${fontSize || '12'}px`,
                    fontWeight: boldFont ? 'bold' : 'normal',
                  }}
                  {...register('content')}
                />
              </div>
            </div>

            <div className="mb-8">
              <div className="text-right mb-4">
                <h3 className="text-md font-semibold text-[#094C6B]">تعريف المتغيرات</h3>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-sm">
                <table className="w-full text-center">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="py-2 px-3">م</th>
                      <th className="py-2 px-3">نوع المتغير</th>
                      <th className="py-2 px-3">وصف المتغير</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="py-2 px-3">1</td>
                      <td className="py-2 px-3">وضع الإضاءة</td>
                      <td className="py-2 px-3">وصف المتغير</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="py-2 px-3">2</td>
                      <td className="py-2 px-3">نوع المتغير</td>
                      <td className="py-2 px-3">وصف المتغير</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sr-only" aria-hidden>
              صفحة {currentPage}
            </div>
      </div>
    </HrPageChrome>
  );
}
