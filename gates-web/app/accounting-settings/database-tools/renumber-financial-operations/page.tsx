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

const OP_TYPES = [
  { value: 'journal-entry', label: 'سند قيد يومية' },
  { value: 'invoice', label: 'فاتورة' },
  { value: 'treasury-receipt', label: 'سند قبض' },
  { value: 'treasury-payment', label: 'سند صرف' },
] as const;

export default function RenumberFinancialOperationsPage() {
  useBackendReachability();

  const router = useRouter();
  const [operationType, setOperationType] =
    useState<(typeof OP_TYPES)[number]['value']>('journal-entry');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const renumberMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/database-tools/renumber-operations',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تم إعادة الترقيم');
        setError('');
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل إعادة الترقيم');
        setSuccess('');
      },
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    renumberMutation.mutate({
      operationType,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      startNumber,
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">إعادة ترقيم العمليات المالية</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[120px]">نوع العملية</span>
                  <select
                    value={operationType}
                    onChange={(e) =>
                      setOperationType(e.target.value as (typeof OP_TYPES)[number]['value'])
                    }
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                  >
                    {OP_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[120px]">من تاريخ</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[120px]">إلى تاريخ</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[120px]">بدء الترقيم من</span>
                  <input
                    type="number"
                    min={1}
                    value={startNumber}
                    onChange={(e) => setStartNumber(Number(e.target.value) || 1)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
                  />
                </div>
              </div>

              <div className="bg-white/80 rounded-2xl border border-[#D6EAF3] shadow p-4 text-sm text-[#0A3D5E]">
                يتم استدعاء <code className="text-xs">POST /database-tools/renumber-operations</code> مع نوع العملية
                والفترة الزمنية ورقم البداية.
              </div>
            </div>

            <div className="flex justify-end">
              <ActionButtons onCancel={() => router.back()} onSave={handleSave} saveText="تنفيذ" />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
