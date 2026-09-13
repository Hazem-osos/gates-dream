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

const OP_OPTIONS = [
  { id: 'journal-entry', label: 'قيود يومية' },
  { id: 'invoice', label: 'فواتير' },
  { id: 'treasury-receipt', label: 'قبض' },
  { id: 'treasury-payment', label: 'صرف' },
  { id: 'all', label: 'الكل' },
] as const;

export default function DeleteCancelledOperationsPage() {
  useBackendReachability();

  const router = useRouter();
  const [password, setPassword] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(['all']));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const delMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/operations-management/delete-cancelled',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تم الحذف');
        setError('');
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل الحذف');
        setSuccess('');
      },
    }
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (id === 'all') return new Set(['all']);
      n.delete('all');
      if (n.has(id)) n.delete(id);
      else n.add(id);
      if (n.size === 0) return new Set(['all']);
      return n;
    });
  };

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!password.trim()) {
      setError('كلمة المرور مطلوبة');
      return;
    }
    const operationTypes = selected.has('all')
      ? ['all']
      : (Array.from(selected) as ('journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment' | 'all')[]);
    delMutation.mutate({
      password: password.trim(),
      operationTypes,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">حذف العمليات الملغاه من قاعدة البيانات</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6">
            <div className="flex flex-wrap gap-6 items-end">
              <div className="flex items-center gap-4">
                <span className="text-[#0A3D5E] font-semibold min-w-[120px]">كلمة المرور</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-[360px] rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                  placeholder="إدخل كلمة المرور"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#0A3D5E] font-semibold">من</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#0A3D5E] font-semibold">إلى</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                />
              </div>
            </div>

            <div className="bg-white/80 rounded-2xl border border-[#D6EAF3] shadow p-4">
              <div className="text-[#0E78AA] font-bold mb-3">ما سيتم حذفه (أنواع العمليات الملغاة)</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {OP_OPTIONS.map((o) => (
                  <label key={o.id} className="flex items-center gap-3 text-[#0A3D5E]">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                      className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded"
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 rounded-xl bg-white border border-[#D6EAF3] text-[#0E78AA] hover:bg-[#F6FBFD]"
              >
                إلغاء
              </button>
              <ActionButtons onCancel={() => router.back()} onSave={handleSave} saveText="حذف" />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
