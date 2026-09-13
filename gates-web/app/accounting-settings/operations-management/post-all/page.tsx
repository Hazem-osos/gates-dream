'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

/** Wave-4 batch document types (see /api/v1/operations/batch-post). */
const DOCUMENT_TYPES = [
  { id: 'JOURNAL_ENTRY', label: 'قيود يومية' },
  { id: 'INVOICE', label: 'فواتير' },
  { id: 'TREASURY', label: 'سندات القبض والصرف' },
  { id: 'POS_SHIFT', label: 'ورديات نقاط البيع' },
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number]['id'];

type BatchResult = {
  totalEligible: number;
  succeeded: number;
  failed: number;
  errorDetails: Array<{ id: string; message: string }>;
};

export default function PostAllFinancialOperationsPage() {
  useBackendReachability();

  const router = useRouter();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<Set<DocumentType>>(
    new Set(DOCUMENT_TYPES.map((t) => t.id))
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<Array<{ documentType: DocumentType } & BatchResult>>([]);

  const toggleType = (id: DocumentType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBatch = async (mode: 'batch-post' | 'batch-unpost') => {
    setError('');
    setSuccess('');
    setResults([]);

    if (!fromDate || !toDate) {
      setError('حدد الفترة (من تاريخ / إلى تاريخ)');
      return;
    }
    if (selected.size === 0) {
      setError('اختر نوع مستند واحد على الأقل');
      return;
    }

    setPending(true);
    const collected: Array<{ documentType: DocumentType } & BatchResult> = [];
    try {
      // The API handles one document type per call, so fan out over the selection.
      for (const documentType of DOCUMENT_TYPES.map((t) => t.id).filter((id) =>
        selected.has(id)
      )) {
        const res = await apiClient.post<BatchResult>(`/operations/${mode}`, {
          documentType,
          fromDate: new Date(fromDate).toISOString(),
          toDate: new Date(toDate).toISOString(),
        });
        if (res.data) collected.push({ documentType, ...res.data });
      }

      setResults(collected);
      const succeeded = collected.reduce((sum, r) => sum + r.succeeded, 0);
      const failed = collected.reduce((sum, r) => sum + r.failed, 0);
      const verb = mode === 'batch-post' ? 'ترحيل' : 'فك ترحيل';
      setSuccess(
        failed === 0
          ? `تم ${verb} ${succeeded} مستند`
          : `تم ${verb} ${succeeded} مستند، وفشل ${failed}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل الترحيل');
    } finally {
      setPending(false);
    }
  };

  const labelFor = (id: DocumentType) =>
    DOCUMENT_TYPES.find((t) => t.id === id)?.label ?? id;

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">ترحيل كل العمليات المالية</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[140px]">من تاريخ</span>
                  <input
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    type="date"
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[140px]">إلى تاريخ</span>
                  <input
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    type="date"
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                  />
                </div>

                <p className="text-sm text-[#0A3D5E]/70 leading-relaxed">
                  يتم الترحيل داخل الفرع والسنة المالية المحددين حالياً، ويُرفض إذا كانت السنة
                  المالية مغلقة.
                </p>

                <button
                  type="button"
                  onClick={() => runBatch('batch-unpost')}
                  disabled={pending}
                  className="h-10 rounded-xl border border-[#CFE7F2] bg-white px-4 font-semibold text-[#0E78AA] disabled:opacity-60"
                >
                  فك الترحيل للفترة المحددة
                </button>
              </div>

              <div className="bg-white/80 rounded-2xl border border-[#D6EAF3] shadow p-4">
                <div className="text-[#0E78AA] font-bold mb-4">ما سيتم ترحيله</div>
                <div className="space-y-3">
                  {DOCUMENT_TYPES.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 text-[#0A3D5E]">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleType(t.id)}
                        className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {results.length > 0 ? (
              <div className="mt-8 overflow-x-auto rounded-2xl border border-[#D6EAF3] bg-white">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      {['المستند', 'المؤهل', 'نجح', 'فشل', 'أخطاء'].map((h) => (
                        <th
                          key={h}
                          className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] px-4 py-3 text-right font-medium text-white"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.documentType} className="border-b border-[#D6EAF3]">
                        <td className="px-4 py-3 text-right text-[#0A3D5E]">
                          {labelFor(r.documentType)}
                        </td>
                        <td className="px-4 py-3 text-right text-[#0A3D5E]">{r.totalEligible}</td>
                        <td className="px-4 py-3 text-right text-green-600">{r.succeeded}</td>
                        <td className="px-4 py-3 text-right text-red-600">{r.failed}</td>
                        <td className="px-4 py-3 text-right text-[#0A3D5E]">
                          {r.errorDetails.length === 0
                            ? '—'
                            : r.errorDetails
                                .slice(0, 3)
                                .map((d) => d.message)
                                .join(' • ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="flex justify-end mt-8">
              <ActionButtons
                onSave={() => void runBatch('batch-post')}
                onCancel={() => router.back()}
                saveText={pending ? 'جاري الترحيل…' : 'ترحيل'}
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
