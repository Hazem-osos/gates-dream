'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type TranslationRow = {
  key: string;
  language1: string;
  language2: string;
  category?: string;
};

export default function TranslateMessagesPage() {
  useBackendReachability();

  const router = useRouter();
  const [language1, setLanguage1] = useState('ar');
  const [language2, setLanguage2] = useState('en');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const queryParams = useMemo(
    () => ({
      language1,
      language2,
      category: category || undefined,
      page: 1,
      limit: 100,
    }),
    [language1, language2, category]
  );

  const { data: listRes, isLoading } = useApiQuery<TranslationRow[]>(
    ['translation', 'messages', language1, language2, category],
    '/translation/messages',
    queryParams
  );

  const invalidate = useInvalidateQuery();

  const bulkMutation = useApiMutation<unknown, { translations: TranslationRow[] }>(
    '/translation/messages/bulk',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تم حفظ الترجمات');
        setError('');
        invalidate(['translation']);
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل الحفظ');
        setSuccess('');
      },
    }
  );

  useEffect(() => {
    const data = listRes?.data;
    if (!Array.isArray(data)) return;
    setRows(
      data.map((t: Record<string, unknown>) => ({
        key: String(t.key ?? ''),
        language1: String(t.language1 ?? ''),
        language2: String(t.language2 ?? ''),
        category: t.category ? String(t.category) : undefined,
      }))
    );
  }, [listRes?.data]);

  const update = (index: number, field: keyof TranslationRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (rows.length === 0) {
      setError('لا توجد صفوف للحفظ');
      return;
    }
    const payload = rows.map((r) => ({
      key: r.key,
      language1: r.language1 || language1,
      language2: r.language2 || language2,
      category: r.category || category || undefined,
    }));
    bulkMutation.mutate({ translations: payload });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">ترجمة الرسائل</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-[#0A3D5E] font-semibold min-w-[100px]">اللغة الأولى</label>
              <input
                value={language1}
                onChange={(e) => setLanguage1(e.target.value)}
                className="w-[200px] py-2 px-3 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD]"
              />
              <label className="text-[#0A3D5E] font-semibold min-w-[100px]">اللغة الثانية</label>
              <input
                value={language2}
                onChange={(e) => setLanguage2(e.target.value)}
                className="w-[200px] py-2 px-3 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD]"
              />
              <label className="text-[#0A3D5E] font-semibold min-w-[80px]">التصنيف</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-[200px] py-2 px-3 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD]"
                placeholder="اختياري"
              />
            </div>

            <div className="border border-[#D6EAF3] rounded-xl overflow-hidden">
              <div className="grid grid-cols-5 bg-[#0E78AA] text-white text-center text-sm">
                <div className="py-2">م</div>
                <div className="py-2">المفتاح</div>
                <div className="py-2">اللغة 1</div>
                <div className="py-2">اللغة 2</div>
                <div className="py-2">التصنيف</div>
              </div>
              {isLoading ? (
                <div className="p-6 text-center">جاري التحميل…</div>
              ) : (
                rows.map((r, i) => (
                  <div
                    key={`${r.key}-${i}`}
                    className="grid grid-cols-5 text-center odd:bg-[#F6FBFD] even:bg-white text-sm"
                  >
                    <div className="py-2 border-b border-[#E6F0F7]">{i + 1}</div>
                    <div className="py-1 border-b border-[#E6F0F7] px-1">
                      <input
                        value={r.key}
                        onChange={(e) => update(i, 'key', e.target.value)}
                        className="w-full bg-transparent text-center outline-none"
                      />
                    </div>
                    <div className="py-1 border-b border-[#E6F0F7] px-1">
                      <input
                        value={r.language1}
                        onChange={(e) => update(i, 'language1', e.target.value)}
                        className="w-full bg-transparent text-center outline-none"
                      />
                    </div>
                    <div className="py-1 border-b border-[#E6F0F7] px-1">
                      <input
                        value={r.language2}
                        onChange={(e) => update(i, 'language2', e.target.value)}
                        className="w-full bg-transparent text-center outline-none"
                      />
                    </div>
                    <div className="py-1 border-b border-[#E6F0F7] px-1">
                      <input
                        value={r.category ?? ''}
                        onChange={(e) => update(i, 'category', e.target.value)}
                        className="w-full bg-transparent text-center outline-none"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end">
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
