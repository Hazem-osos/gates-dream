'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useEffect, useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useApiMutation } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

export default function DatabaseRestorePage() {
  useBackendReachability();

  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('');
  const [restoreData, setRestoreData] = useState(true);
  const [restoreSchema, setRestoreSchema] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const restoreMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/database-tools/restore',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم استرجاع قاعدة البيانات');
        setError('');
        setOpen(false);
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل الاسترجاع');
        setSuccess('');
      },
    }
  );

  useEffect(() => {
    setOpen(true);
  }, []);

  const runRestore = () => {
    setError('');
    setSuccess('');
    if (!path.trim()) {
      setError('أدخل مسار ملف النسخة الاحتياطية');
      return;
    }
    restoreMutation.mutate({
      backupFile: path.trim(),
      restoreData,
      restoreSchema,
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">الإسترجاع لقاعدة البيانات</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-6 text-[#0A3D5E]">اختر ملف النسخة الاحتياطية من الحوار أو أدخل المسار الكامل.</div>
        </InnerCard>
      </OuterCard>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl w-[720px] max-w-[95%] shadow-xl border border-[#D6EAF3]">
            <div className="px-6 py-4 border-b border-[#E6F0F7] text-center font-bold text-[#0A3D5E]">
              الإسترجاع لقاعدة البيانات
            </div>
            <div className="px-6 py-6">
              <div className="grid grid-cols-3 items-center gap-4 mb-4">
                <label className="text-[#0A3D5E] font-semibold">مسار الملف</label>
                <div className="col-span-2">
                  <div className="relative">
                    <input
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      className="w-full p-2.5 pr-10 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0E78AA]">📁</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-6 text-[#0A3D5E]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={restoreData}
                    onChange={(e) => setRestoreData(e.target.checked)}
                    className="w-4 h-4"
                  />
                  استرجاع البيانات
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={restoreSchema}
                    onChange={(e) => setRestoreSchema(e.target.checked)}
                    className="w-4 h-4"
                  />
                  استرجاع الهيكل
                </label>
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-center gap-4 border-t border-[#E6F0F7]">
              <button
                onClick={() => setOpen(false)}
                className="px-10 py-3 rounded-xl bg-[#2C6FE4] text-white hover:opacity-95 transition-all"
              >
                إغلاق
              </button>
              <button
                onClick={runRestore}
                disabled={restoreMutation.isPending}
                className="px-10 py-3 rounded-xl bg-[#20B26B] text-white hover:opacity-95 transition-all disabled:opacity-60"
              >
                {restoreMutation.isPending ? 'جاري الاسترجاع…' : 'إسترجاع'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
