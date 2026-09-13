'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useEffect, useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useRouter } from 'next/navigation';
import { useApiMutation } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

export default function FixAverageCostPage() {
  useBackendReachability();

  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [recalculateFromDate, setRecalculateFromDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fixMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/operations-management/fix-average-cost',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تم إعادة احتساب متوسط التكلفة');
        setError('');
        setOpen(false);
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل الطلب');
        setSuccess('');
      },
    }
  );

  useEffect(() => {
    setOpen(true);
  }, []);

  const confirm = () => {
    setError('');
    setSuccess('');
    fixMutation.mutate({
      recalculateFromDate: recalculateFromDate || undefined,
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">إصلاح متوسط التكلفة</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-6 text-[#0A3D5E] space-y-3">
            <p>اختياري: حدّد تاريخاً لإعادة الاحتساب منه لجميع الأصناف والمستودعات.</p>
            <div className="flex items-center gap-4 max-w-md">
              <label className="font-semibold">من تاريخ</label>
              <input
                type="date"
                value={recalculateFromDate}
                onChange={(e) => setRecalculateFromDate(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-2"
              />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl w-[680px] max-w-[90%] shadow-xl border border-[#D6EAF3]">
            <div className="px-6 py-4 border-b border-[#E6F0F7] text-center font-bold text-[#0A3D5E]">
              إعادة إحتساب متوسط التكلفة
            </div>
            <div className="px-6 py-6 text-center text-[#0A3D5E]">
              هل أنت متأكد من تفعيل إعادة إحتساب متوسط التكلفة؟ سيتم الإرسال إلى الخادم.
            </div>
            <div className="px-6 py-4 flex items-center justify-center gap-4 border-t border-[#E6F0F7]">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-10 py-3 rounded-xl bg-[#2C6FE4] text-white hover:opacity-95 transition-all"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={fixMutation.isPending}
                className="px-10 py-3 rounded-xl bg-[#20B26B] text-white hover:opacity-95 transition-all disabled:opacity-60"
              >
                {fixMutation.isPending ? 'جاري…' : 'تفعيل'}
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
