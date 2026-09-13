'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { Pagination } from '@/components/ui/Pagination';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type UnitRow = { id: string; code?: string | null; arabicName: string; englishName?: string | null };

export default function CreateInputUnitPage() {
  useBackendReachability();

  const router = useRouter();
  const [code, setCode] = useState('');
  const [arabicName, setArabicName] = useState('');
  const [englishName, setEnglishName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: unitsRes, isLoading } = useApiQuery<UnitRow[]>(
    ['inventory', 'units', 'settings', page],
    '/inventory/units',
    { page, limit: pageSize }
  );

  const invalidate = useInvalidateQuery();

  const createMutation = useApiMutation<unknown, Record<string, unknown>>('/inventory/units', 'POST', {
    onSuccess: (res) => {
      setSuccess(res.message || 'تم إنشاء الوحدة');
      setError('');
      setCode('');
      setArabicName('');
      setEnglishName('');
      invalidate(['inventory']);
    },
    onError: (e: { message?: string }) => {
      setError(e?.message || 'فشل الحفظ');
      setSuccess('');
    },
  });

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!arabicName.trim()) {
      setError('الإسم العربي مطلوب');
      return;
    }
    createMutation.mutate({
      code: code.trim() || undefined,
      arabicName: arabicName.trim(),
      englishName: englishName.trim() || undefined,
    });
  };

  const handleBack = () => router.back();

  const units = unitsRes?.data ?? [];
  const total = unitsRes?.pagination?.total ?? unitsRes?.meta?.total ?? units.length;

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">إنشاء وحدة إدخال جديدة</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <div className="flex justify-end items-center mb-4">
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6">
            <div className="rounded-xl border border-[#D6EAF3] overflow-hidden">
              <div className="bg-[#0E78AA] text-white px-4 py-2 font-semibold">الوحدات الحالية</div>
              <div className="max-h-48 overflow-y-auto text-sm">
                {isLoading ? (
                  <div className="p-4 text-center">جاري التحميل…</div>
                ) : units.length === 0 ? (
                  <div className="p-4 text-center text-gray-600">لا توجد وحدات</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-[#F6FBFD]">
                      <tr>
                        <th className="p-2 text-right">الكود</th>
                        <th className="p-2 text-right">العربية</th>
                        <th className="p-2 text-right">الإنجليزية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((u) => (
                        <tr key={u.id} className="border-t border-[#E6F0F7]">
                          <td className="p-2">{u.code ?? '—'}</td>
                          <td className="p-2">{u.arabicName}</td>
                          <td className="p-2">{u.englishName ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[120px]">الكود</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                    placeholder="اختياري"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[120px]">الإسم العربي</span>
                  <input
                    value={arabicName}
                    onChange={(e) => setArabicName(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                    placeholder="إلزامي"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[120px]">الإسم الإنجليزي</span>
                  <input
                    value={englishName}
                    onChange={(e) => setEnglishName(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                    placeholder="اختياري"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="text-xs text-gray-500">POST /inventory/units</div>
              <ActionButtons onCancel={handleBack} onSave={handleSave} />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
