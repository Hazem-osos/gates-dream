'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { UserPermissions } from '@/components/ui/UserPermissions';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import SuccessToast from '@/components/SuccessToast';
import ErrorToast from '@/components/ErrorToast';

export default function ImportItemsPage() {
  useBackendReachability();

  const router = useRouter();
  const [importSuccess, setImportSuccess] = useState('');
  const [importError, setImportError] = useState('');

  const inputCls = "h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm shadow-sm hover:shadow-md";
  
  const labelCls = "text-[#0A3D5E] font-semibold text-sm mb-1 block text-right";

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      {importError ? <ErrorToast message={importError} onClose={() => setImportError('')} /> : null}
      {importSuccess ? <SuccessToast message={importSuccess} onClose={() => setImportSuccess('')} /> : null}
      {/* Title */}
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-xl font-bold text-[#0E78AA] mb-2">دليل الأصناف - استيراد الأصناف</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>
      
      <div className="flex justify-between mb-4">
        <UserPermissions />
      </div>
      
      <OuterCard>
        <InnerCard>
          <div className="p-6 space-y-6">
            {/* Top row: title and toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="px-6 py-3 bg-gradient-to-r from-[#0E78AA] to-[#1E88E5] text-white font-bold rounded-lg hover:from-[#1E88E5] hover:to-[#0E78AA] transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
                  📥 تحميل الإكسيل
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Combined Border Section for اسم المجموعة and رقم المجموعة */}
              <div className="p-4 border-2 border-[#0E78AA] rounded-lg bg-[#F6FBFD]">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className={labelCls}>اسم المجموعة</label>
                    <input className={inputCls} placeholder="اسم المجموعة" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>رقم المجموعة</label>
                    <input className={inputCls} placeholder="رقم المجموعة" />
                  </div>
                </div>
              </div>

              {/* Two Column Form */}
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-4">

                  <div className="space-y-2">
                    <label className={labelCls}>الناشر</label>
                    <input className={inputCls} placeholder="الناشر" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>المؤلف</label>
                    <input className={inputCls} placeholder="المؤلف" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>مؤلف ثاني : المحقق</label>
                    <input className={inputCls} placeholder="مؤلف ثاني : المحقق" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>نوع الغلاف</label>
                    <input className={inputCls} placeholder="نوع الغلاف" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>سنة النشر</label>
                    <input className={inputCls} placeholder="سنة النشر" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>رقم ISBN</label>
                    <input className={inputCls} placeholder="رقم ISBN" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>رقم الطبعة</label>
                    <input className={inputCls} placeholder="رقم الطبعة" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>عدد الصفحات</label>
                    <input className={inputCls} placeholder="عدد الصفحات" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>تصنيف فرعي أول</label>
                    <input className={inputCls} placeholder="تصنيف فرعي أول" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>تصنيف فرعي ثاني</label>
                    <input className={inputCls} placeholder="تصنيف فرعي ثاني" />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 p-3 bg-[#F0F8F0] rounded-lg border border-[#4CAF50]/20">
                      <div className="flex items-center gap-2">
                       
                        <label htmlFor="manufacturer" className="text-[#0A3D5E] font-semibold text-sm cursor-pointer">
                          المصنع
                        </label>
                        <input 
                          type="checkbox" 
                          id="manufacturer" 
                          className="w-4 h-4 text-[#0E78AA] bg-white border border-[#0E78AA] rounded focus:ring-2 focus:ring-[#0E78AA]/20 transition-all duration-200"
                        />
                      </div>
                      <div className="flex-1">
                        
                        <label className="text-[#0A3D5E] font-semibold text-sm mb-1 block text-right">السطر الأول عناوين</label>
                      
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>الإسم العربي</label>
                    <input className={inputCls} placeholder="الإسم العربي" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>الإسم الإنجليزي</label>
                    <input className={inputCls} placeholder="الإسم الإنجليزي" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>الوحدة</label>
                    <input className={inputCls} placeholder="الوحدة" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>السعر 1</label>
                    <input className={inputCls} placeholder="السعر 1" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>السعر 2</label>
                    <input className={inputCls} placeholder="السعر 2" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>السعر 3</label>
                    <input className={inputCls} placeholder="السعر 3" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>السعر 4</label>
                    <input className={inputCls} placeholder="السعر 4" />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>السعر 5</label>
                    <input className={inputCls} placeholder="السعر 5" />
                  </div>
                </div>
              </div>

              {/* Table Section */}
              <div className="mt-8">
                <div className="overflow-x-auto rounded-2xl">
                  <table className="min-w-full text-center border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20 rounded-tr-2xl">1</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">2</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">3</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">4</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md border-r border-white/20">5</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-4 px-3 font-bold shadow-md rounded-tl-2xl"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 5 }, (_, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                          <td className="py-3 px-4 border-x border-[#D6EAF3] text-gray-500">-</td>
                          <td className="py-3 px-4 border-x border-[#D6EAF3] text-gray-500">-</td>
                          <td className="py-3 px-4 border-x border-[#D6EAF3] text-gray-500">-</td>
                          <td className="py-3 px-4 border-x border-[#D6EAF3] text-gray-500">-</td>
                          <td className="py-3 px-4 border-x border-[#D6EAF3] text-gray-500">-</td>
                          <td className="py-3 px-4 border-x border-[#D6EAF3] text-gray-500">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end pt-4">
              <ActionButtons
                onCancel={() => router.back()}
                onSave={() => {
                  setImportError('');
                  setImportSuccess(
                    'تم تجهيز الاستيراد في الواجهة. ربط ملف الإكسيل بواجهة برمجة استيراد الأصناف غير مفعّل بعد.'
                  );
                }}
              />
            </div>
          </div>
        </InnerCard>
      </OuterCard>
    </div>
  );
}
