'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { Pagination } from '@/components/ui/Pagination';
import { ActionButtons } from '@/components/ui/ActionButtons';
import CrudButtons from '@/components/ui/CrudButtons';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type DocRow = {
  id: string;
  voucherNumber?: string;
  invoiceNumber?: string;
  date?: string;
  description?: string | null;
};

export default function ApproveDocumentsPage() {
  useBackendReachability();

  const router = useRouter();
  const [documentType, setDocumentType] = useState<'journal-entry' | 'invoice'>('journal-entry');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approveAll, setApproveAll] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const params = useMemo(
    () => ({ ...(documentType ? { documentType } : {}), page, limit: pageSize }),
    [documentType, page]
  );

  const { data: listRes, isLoading } = useApiQuery<DocRow[]>(
    ['database-tools', 'unapproved-documents', documentType, page],
    '/database-tools/unapproved-documents',
    params
  );

  const invalidate = useInvalidateQuery();

  const approveMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/database-tools/approve-documents',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تمت المعالجة');
        setError('');
        setSelected(new Set());
        invalidate(['database-tools']);
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل الإعتماد');
        setSuccess('');
      },
    }
  );

  const rows = listRes?.data ?? [];
  const total = listRes?.pagination?.total ?? listRes?.meta?.total ?? rows.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (approveAll) {
      approveMutation.mutate({
        documentIds: [],
        documentType,
        approveAll: true,
      });
      return;
    }
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setError('اختر مستندات أو فعّل «اعتماد الكل»');
      return;
    }
    approveMutation.mutate({
      documentIds: ids,
      documentType,
      approveAll: false,
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">إعتماد المستندات</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm" />
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <span className="text-[#0A3D5E] font-semibold min-w-[90px]">المستند</span>
                <select
                  value={documentType}
                  onChange={(e) => {
                    setDocumentType(e.target.value as 'journal-entry' | 'invoice');
                    setSelected(new Set());
                    setPage(1);
                  }}
                  className="h-10 w-[360px] rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2 text-[#0A3D5E]"
                >
                  <option value="journal-entry">سند قيد / قيود يومية</option>
                  <option value="invoice">فاتورة</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-[#0A3D5E]">
                <input
                  type="checkbox"
                  checked={approveAll}
                  onChange={(e) => setApproveAll(e.target.checked)}
                  className="w-4 h-4"
                />
                اعتماد كل المستندات غير المعتمدة لهذا النوع
              </label>
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            </div>

            <div className="border border-[#D6EAF3] rounded-xl overflow-hidden">
              <div className="grid grid-cols-4 bg-[#0E78AA] text-white text-center">
                <div className="py-2">اختيار</div>
                <div className="py-2">الرقم</div>
                <div className="py-2">التاريخ</div>
                <div className="py-2">الوصف</div>
              </div>
              {isLoading ? (
                <div className="p-6 text-center text-[#0A3D5E]">جاري التحميل…</div>
              ) : (
                rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-4 text-center odd:bg-[#F6FBFD] even:bg-white border-b border-[#E6F0F7]"
                  >
                    <div className="py-4 flex justify-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        disabled={approveAll}
                        className="w-5 h-5"
                      />
                    </div>
                    <div className="py-4 text-[#0A3D5E]">
                      {documentType === 'journal-entry' ? row.voucherNumber : row.invoiceNumber}
                    </div>
                    <div className="py-4 text-[#0A3D5E]">
                      {row.date ? String(row.date).slice(0, 10) : '—'}
                    </div>
                    <div className="py-4 text-[#0A3D5E] text-sm">{row.description ?? '—'}</div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between">
              <CrudButtons />
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
