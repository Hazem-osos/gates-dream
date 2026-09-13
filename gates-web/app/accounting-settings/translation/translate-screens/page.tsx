'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

export default function TranslateScreensPage() {
  useBackendReachability();

  const router = useRouter();
  const [screenName, setScreenName] = useState('accounting-settings');
  const [language1, setLanguage1] = useState('ar');
  const [language2, setLanguage2] = useState('en');
  const [pairs, setPairs] = useState<{ key: string; v1: string; v2: string }[]>([
    { key: 'title', v1: '', v2: '' },
  ]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: screenRes, refetch, isError } = useApiQuery<Record<string, unknown>>(
    ['translation', 'screen', screenName],
    `/translation/screens/${encodeURIComponent(screenName)}`,
    undefined,
    { retry: false }
  );

  const invalidate = useInvalidateQuery();

  const saveMutation = useApiMutation<unknown, Record<string, unknown>>('/translation/screens', 'POST', {
    onSuccess: (res) => {
      setSuccess(res.message || 'تم الحفظ');
      setError('');
      invalidate(['translation']);
      void refetch();
    },
    onError: (e: { message?: string }) => {
      setError(e?.message || 'فشل الحفظ');
      setSuccess('');
    },
  });

  useEffect(() => {
    if (isError) return;
    const d = screenRes?.data;
    if (!d || typeof d !== 'object') return;
    const tr = (d as { translations?: Record<string, string> }).translations;
    if (!tr || typeof tr !== 'object') return;
    const keys = Object.keys(tr);
    if (keys.length === 0) return;
    setPairs(
      keys.map((k) => ({
        key: k,
        v1: String(tr[k] ?? ''),
        v2: '',
      }))
    );
  }, [screenRes?.data, isError]);

  const updatePair = (i: number, field: 'key' | 'v1' | 'v2', value: string) => {
    setPairs((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], [field]: value };
      return n;
    });
  };

  const addRow = () => setPairs((p) => [...p, { key: '', v1: '', v2: '' }]);

  const handleSave = () => {
    setError('');
    setSuccess('');
    const translations: Record<string, string> = {};
    for (const p of pairs) {
      if (p.key.trim()) translations[p.key.trim()] = p.v1;
    }
    saveMutation.mutate({
      screenName: screenName.trim(),
      language1,
      language2,
      translations,
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">ترجمة الشاشات</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-sm text-[#0A3D5E] font-semibold block mb-1">اسم الشاشة</label>
                <input
                  value={screenName}
                  onChange={(e) => setScreenName(e.target.value)}
                  className="h-10 w-56 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                />
              </div>
              <div>
                <label className="text-sm text-[#0A3D5E] font-semibold block mb-1">اللغة 1</label>
                <input
                  value={language1}
                  onChange={(e) => setLanguage1(e.target.value)}
                  className="h-10 w-24 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                />
              </div>
              <div>
                <label className="text-sm text-[#0A3D5E] font-semibold block mb-1">اللغة 2</label>
                <input
                  value={language2}
                  onChange={(e) => setLanguage2(e.target.value)}
                  className="h-10 w-24 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                />
              </div>
              <button
                type="button"
                onClick={() => void refetch()}
                className="h-10 px-4 rounded-xl bg-[#0E78AA] text-white"
              >
                تحميل
              </button>
              <button type="button" onClick={addRow} className="h-10 px-4 rounded-xl border border-[#D6EAF3]">
                صف جديد
              </button>
            </div>

            <div className="border border-[#D6EAF3] rounded-xl overflow-hidden">
              <div className="grid grid-cols-4 bg-[#0E78AA] text-white text-center text-sm">
                <div className="py-2">المفتاح</div>
                <div className="py-2">نص اللغة 1</div>
                <div className="py-2">نص اللغة 2 (مرجعي)</div>
                <div className="py-2">—</div>
              </div>
              {pairs.map((p, i) => (
                <div key={i} className="grid grid-cols-4 gap-1 p-2 border-b border-[#E6F0F7] odd:bg-[#F6FBFD]">
                  <input
                    value={p.key}
                    onChange={(e) => updatePair(i, 'key', e.target.value)}
                    className="rounded border border-[#D6EAF3] px-2 text-sm"
                  />
                  <input
                    value={p.v1}
                    onChange={(e) => updatePair(i, 'v1', e.target.value)}
                    className="rounded border border-[#D6EAF3] px-2 text-sm"
                  />
                  <input
                    value={p.v2}
                    onChange={(e) => updatePair(i, 'v2', e.target.value)}
                    className="rounded border border-[#D6EAF3] px-2 text-sm"
                  />
                  <span className="text-xs text-gray-500 flex items-center">يُحفظ في الحقل الأول</span>
                </div>
              ))}
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
