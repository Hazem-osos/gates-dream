'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApiMutation } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

export default function ImportEntryPage() {
  useBackendReachability();

  const router = useRouter();
  const [file, setFile] = useState('');
  const [format, setFormat] = useState<'csv' | 'excel' | 'json'>('csv');
  const [entryType, setEntryType] = useState<
    'journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment'
  >('journal-entry');
  const [validateBeforeImport, setValidateBeforeImport] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const importMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/operations-management/import-entry',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تم الاستيراد');
        setError('');
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل الاستيراد');
        setSuccess('');
      },
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!file.trim()) {
      setError('أدخل مسار الملف');
      return;
    }
    importMutation.mutate({
      file: file.trim(),
      format,
      entryType,
      validateBeforeImport,
    });
  };

  const rowIndexes = Array.from({ length: 8 }, (_, i) => i + 1);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      {/* Page Title */}
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">إستيراد قيد</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm" />
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6">
            <div className="flex flex-wrap gap-4 items-end bg-white/80 rounded-xl border border-[#D6EAF3] p-4">
              <div>
                <label className="text-[#0A3D5E] text-sm font-semibold block mb-1">مسار الملف</label>
                <input
                  value={file}
                  onChange={(e) => setFile(e.target.value)}
                  className="h-10 w-72 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
                  placeholder="/path/to/file.csv"
                />
              </div>
              <div>
                <label className="text-[#0A3D5E] text-sm font-semibold block mb-1">التنسيق</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'csv' | 'excel' | 'json')}
                  className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="text-[#0A3D5E] text-sm font-semibold block mb-1">نوع القيد</label>
                <select
                  value={entryType}
                  onChange={(e) =>
                    setEntryType(
                      e.target.value as 'journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment'
                    )
                  }
                  className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2 min-w-[160px]"
                >
                  <option value="journal-entry">قيد يومية</option>
                  <option value="invoice">فاتورة</option>
                  <option value="treasury-receipt">قبض</option>
                  <option value="treasury-payment">صرف</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-[#0A3D5E] pb-1">
                <input
                  type="checkbox"
                  checked={validateBeforeImport}
                  onChange={(e) => setValidateBeforeImport(e.target.checked)}
                  className="w-4 h-4"
                />
                التحقق قبل الاستيراد
              </label>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left side - entry date and narrative */}
   

              {/* Right side - column numbers */}
              <div className="space-y-3">
                <div className="text-[#0E78AA] font-bold">أرقام الأعمدة</div>
                {[
                  'رقم الحساب', 'إسم الحساب', 'الشرح', 'رقم العملة', 'إسم العملة', 'مدين', 'دائن', 'رقم مركز التكلفة', 'إسم مركز التكلفة'
                ].map((label, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="text-[#0A3D5E] font-semibold min-w-[140px]">{label}</span>
                    <input className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]" placeholder={label.includes('إسم') ? '' : ''} />
                  </div>
                ))}
              </div>
              <div className="space-y-5">
                <div className="text-[#0E78AA] font-bold">تاريخ القيد</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                   <label className="text-[#0A3D5E] font-semibold min-w-[140px]"> تاريخ</label>
                    <input className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]" defaultValue="26-11-2025" />
                   
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[#0A3D5E] font-semibold min-w-[140px]"> الهجري</label>
                    <input className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]" defaultValue="26-11-2025" />
                
                  </div>
                </div>

                <div className="text-[#0E78AA] font-bold pt-2">شرح القيد</div>
                <textarea className="w-full h-24 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 py-2 text-[#0A3D5E]" />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[#0A3D5E]">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded" />
                    السطر الأول عناوين
                  </label>
                  <button className="px-5 py-2 rounded-xl bg-white border border-[#D6EAF3] text-[#0E78AA] hover:bg-[#F6FBFD] flex items-center gap-2">
                    <span className="text-lg">⏏</span>
                    تحميل الاكسيل
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="border border-[#D6EAF3] rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 bg-[#0E78AA] text-white text-center">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="py-2"></div>
                ))}
                <div className="py-2">م</div>
              </div>
              {rowIndexes.map((r) => (
                <div key={r} className="grid grid-cols-12 text-center odd:bg-[#F6FBFD] even:bg-white">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <div key={i} className="py-3 border-b border-[#E6F0F7]"></div>
                  ))}
                  <div className="py-3 border-b border-[#E6F0F7]">{r}</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end">
              <ActionButtons
                onCancel={() => router.back()}
                onSave={handleSave}
              />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}


