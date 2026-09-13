'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { FormCard, Button, StatusBadge } from '@/components/ui';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type InvoiceRow = {
  id: string;
  serialNumber?: string;
  voucherNumber?: string;
  netAmount?: number;
  etaStatus?: string | null;
  isPosted?: boolean;
};

export function EtaSubmissionHub() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useApiQuery<InvoiceRow[]>(
    ['eta-hub-invoices'],
    '/invoices',
    { invoiceKind: 'SALE', isPosted: true, limit: 50 }
  );

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    return list.filter((r) => !r.etaStatus || r.etaStatus === 'PENDING' || r.etaStatus === 'NOT_SUBMITTED');
  }, [data?.data]);

  const submitMutation = useApiMutation<unknown, { invoiceIds: string[] }>(
    '/eta/documents/submit',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم جدولة إرسال الدفعة إلى ETA');
        void refetch();
      },
      onError: (e) => setError(e.message || 'فشل الإرسال'),
    }
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ErpDocumentLayout className="mt-4">
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/electronic-invoices', label: 'الفواتير الإلكترونية' },
          { label: 'مركز الإرسال' },
        ]}
        title="مركز إرسال ETA"
        statusTone="warning"
        statusLabel={`${rows.length} غير مرسلة`}
        onSaveDraft={() => {
          if (selected.size === 0) {
            setError('حدد فاتورة واحدة على الأقل');
            return;
          }
          submitMutation.mutate({ invoiceIds: [...selected] });
        }}
        onPost={() => void refetch()}
        saveLabel="إرسال المحدد"
        postLabel="تحديث"
        savePending={submitMutation.isPending}
        canPost
        extraActions={
          <Link href="/electronic-invoices/creations/send-invoice">
            <Button variant="outline" size="sm">
              إرسال فردي
            </Button>
          </Link>
        }
      />

      <FormCard title="قائمة انتظار الإرسال" bodyClassName="p-3">
        {isLoading ? (
          <p className="text-sm text-slate-500 py-6 text-center">جاري التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">لا توجد فواتير معلقة للإرسال.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="p-2">تحديد</th>
                  <th className="p-2 text-right">الفاتورة</th>
                  <th className="p-2">الصافي</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">معاينة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const label = row.serialNumber || row.voucherNumber || row.id.slice(0, 8);
                  return (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="p-2 text-center">
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                      </td>
                      <td className="p-2">{label}</td>
                      <td className="p-2 tabular-nums">{Number(row.netAmount ?? 0).toFixed(2)}</td>
                      <td className="p-2">
                        <StatusBadge variant="warning" label="غير مرسلة" compact />
                      </td>
                      <td className="p-2">
                        <Button variant="outline" size="sm" onClick={() => setPreviewId(row.id)}>
                          JSON
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormCard>

      {previewId ? (
        <FormCard title="معاينة" bodyClassName="p-3 mt-3">
          <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto max-h-64">
            {JSON.stringify({ invoiceId: previewId }, null, 2)}
          </pre>
        </FormCard>
      ) : null}
    </ErpDocumentLayout>
  );
}
