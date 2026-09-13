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

export default function LatePaymentPenaltyPage() {
  useBackendReachability();

  const router = useRouter();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [penaltyRate, setPenaltyRate] = useState(10);
  const [penaltyType, setPenaltyType] = useState<'daily' | 'monthly' | 'fixed'>('daily');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const penaltyMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/operations-management/late-payment-penalty',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تم تطبيق الغرامات');
        setError('');
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل التطبيق');
        setSuccess('');
      },
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!fromDate || !toDate) {
      setError('حدد فترة من وإلى');
      return;
    }
    penaltyMutation.mutate({
      fromDate,
      toDate,
      penaltyRate,
      penaltyType,
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">غرامة التأخير في السداد</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <div className="flex items-center gap-4">
                <span className="text-[#0A3D5E] font-semibold min-w-[100px]">من تاريخ</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#0A3D5E] font-semibold min-w-[100px]">إلى تاريخ</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#0A3D5E] font-semibold min-w-[100px]">نسبة الغرامة</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={penaltyRate}
                  onChange={(e) => setPenaltyRate(Number(e.target.value))}
                  className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#0A3D5E] font-semibold min-w-[100px]">نوع الغرامة</span>
                <select
                  value={penaltyType}
                  onChange={(e) => setPenaltyType(e.target.value as 'daily' | 'monthly' | 'fixed')}
                  className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                >
                  <option value="daily">يومية</option>
                  <option value="monthly">شهرية</option>
                  <option value="fixed">ثابتة</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <ActionButtons onCancel={() => router.back()} onSave={handleSave} />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
