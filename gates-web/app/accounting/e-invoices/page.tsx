'use client';

import React, { useMemo, useState } from 'react';
import OuterCard from '@/components/OuterCard';
import { StatusBadge, Button } from '@/components/ui';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type QueueRow = {
  invoiceId: string;
  invoiceNumber: string | null;
  date: string;
  customerName: string | null;
  netAmount: number;
  isPosted: boolean;
  etaStatus: string;
  documentUuid: string | null;
  validationErrors: { property?: string; message?: string }[] | null;
  submittedAt: string | null;
};

function etaStatusBadge(status: string, errors: QueueRow['validationErrors']) {
  switch (status) {
    case 'VALID':
      return <StatusBadge variant="success" label="صحيحة (Valid)" />;
    case 'INVALID':
      return (
        <span title={errors?.map((e) => e.message).join('\n') ?? ''}>
          <StatusBadge variant="danger" label="مرفوضة (Invalid)" />
        </span>
      );
    case 'PROCESSING':
      return <StatusBadge variant="warning" label="قيد المعالجة" />;
    default:
      return <StatusBadge variant="neutral" label="غير مرسلة" />;
  }
}

export default function EInvoicesDashboardPage() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const invalidateQuery = useInvalidateQuery();

  const { data, isLoading, refetch } = useApiQuery<QueueRow[]>(
    ['eta-queue'],
    '/eta/documents/queue',
    { limit: 100 }
  );

  const rows = data?.data ?? [];

  const submitMutation = useApiMutation<
    { results: Array<{ invoiceId: string; ok: boolean; error?: string }> },
    { invoiceIds: string[] }
  >('/eta/documents/submit', 'POST');

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectable = useMemo(
    () => rows.filter((r) => r.isPosted && r.etaStatus !== 'VALID' && r.etaStatus !== 'PROCESSING'),
    [rows]
  );

  const handleBatchSubmit = async () => {
    setError('');
    setSuccess('');
    const ids = [...selected];
    if (!ids.length) {
      setError('حدد فاتورة واحدة على الأقل');
      return;
    }
    try {
      const res = await submitMutation.mutateAsync({ invoiceIds: ids });
      const failed = res.data?.results?.filter((r) => !r.ok) ?? [];
      if (failed.length) {
        setError(failed.map((f) => f.error ?? f.invoiceId).join(' | '));
      } else {
        setSuccess('تم جدولة إرسال الفواتير المحددة لمصلحة الضرائب');
      }
      setSelected(new Set());
      invalidateQuery(['eta-queue']);
      void refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل الإرسال');
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ direction: 'rtl' }}>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
      <OuterCard>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0E78AA]">الفواتير الإلكترونية — ETA</h1>
            <p className="text-sm text-gray-600 mt-1">منظومة الفاتورة والإيصال الإلكتروني (مصلحة الضرائب المصرية)</p>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={submitMutation.isPending || selected.size === 0}
            onClick={() => void handleBatchSubmit()}
          >
            {submitMutation.isPending ? 'جاري الإرسال...' : 'إرسال الفواتير المحددة لمصلحة الضرائب'}
          </Button>
        </div>

        {isLoading && <p className="text-gray-600">جاري التحميل...</p>}

        <div className="overflow-x-auto rounded-xl border border-[#D6EAF3]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0E78AA] text-white">
                <th className="p-2">تحديد</th>
                <th className="p-2">رقم الفاتورة</th>
                <th className="p-2">التاريخ</th>
                <th className="p-2">العميل</th>
                <th className="p-2">الصافي</th>
                <th className="p-2">ETA</th>
                <th className="p-2">UUID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const canSelect =
                  row.isPosted &&
                  row.etaStatus !== 'VALID' &&
                  row.etaStatus !== 'PROCESSING';
                return (
                  <tr key={row.invoiceId} className="border-t border-[#D6EAF3] hover:bg-slate-50">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!canSelect}
                        checked={selected.has(row.invoiceId)}
                        onChange={() => toggle(row.invoiceId)}
                      />
                    </td>
                    <td className="p-2">{row.invoiceNumber ?? '—'}</td>
                    <td className="p-2">{row.date.split('T')[0]}</td>
                    <td className="p-2">{row.customerName ?? '—'}</td>
                    <td className="p-2">{row.netAmount.toLocaleString('ar-EG')}</td>
                    <td className="p-2">{etaStatusBadge(row.etaStatus, row.validationErrors as QueueRow['validationErrors'])}</td>
                    <td className="p-2 font-mono text-xs">
                      {row.documentUuid ? (
                        <StatusBadge variant="info" label={row.documentUuid.slice(0, 8)} compact />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    لا توجد فواتير مبيعات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectable.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {selectable.length} فاتورة مرحّلة جاهزة للإرسال (غير مُرسلة أو مرفوضة)
          </p>
        )}
      </OuterCard>
    </div>
  );
}
