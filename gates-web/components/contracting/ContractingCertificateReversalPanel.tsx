'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatDateAr } from '@/lib/subcontracts/money';

type Props = {
  reversePath: string;
  originalJournalEntryId?: string | null;
  reversedAt?: string | null;
  reversedBy?: string | null;
  reversalReason?: string | null;
  reversalJournalEntryId?: string | null;
  status: string;
  onChanged?: () => void;
};

function parseBlockedMessage(error: unknown): string {
  const msg =
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data
      ? String((error.response.data as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : 'تعذّر عكس المستخلص';

  if (msg.includes('ACTIVE_SETTLEMENT_BLOCKS_REVERSAL')) {
    return 'لا يمكن العكس: يوجد تحصيل/سداد خزينة نشط. ألغِ ترحيل سندات الخزينة المرتبطة أولاً.';
  }
  if (msg.includes('LATER_CERTIFICATE_BLOCKS_REVERSAL')) {
    return 'لا يمكن العكس: يوجد مستخلص لاحق على نفس العقد. اعكس المستخلصات الأحدث أولاً.';
  }
  return msg;
}

export function ContractingCertificateReversalPanel({
  reversePath,
  originalJournalEntryId,
  reversedAt,
  reversalReason,
  reversalJournalEntryId,
  status,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const idempotencyKeyRef = useRef<string | null>(null);

  const reverseMutation = useMutation({
    mutationFn: async () => {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      return apiClient.post(reversePath, {
        idempotencyKey: idempotencyKeyRef.current,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      notifyApiSuccess('تم عكس المستخلص مالياً');
      setOpen(false);
      setReason('');
      idempotencyKeyRef.current = null;
      onChanged?.();
    },
  });

  if (status === 'REVERSED') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" dir="rtl">
        <p className="font-bold text-amber-900">مستخلص معكوس مالياً</p>
        <ul className="mt-2 space-y-1 text-amber-900/90">
          <li>القيد الأصلي: {originalJournalEntryId ?? '—'} (بدون تعديل)</li>
          <li>قيد العكس: {reversalJournalEntryId ?? '—'}</li>
          {reversedAt ? <li>تاريخ العكس: {formatDateAr(reversedAt)}</li> : null}
          {reversalReason ? <li>السبب: {reversalReason}</li> : null}
        </ul>
      </div>
    );
  }

  const canReverse = status === 'FINANCE_POSTED' || status === 'PAID';
  if (!canReverse) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-[#094C6B]">عكس مالي للمستخلص</p>
          <p className="text-xs text-slate-600">
            يُنشأ قيد عكس بتاريخ اليوم؛ القيد الأصلي يبقى كما هو.
          </p>
        </div>
        <Button variant="secondary" iconStart={<RotateCcw className="h-4 w-4" />} onClick={() => setOpen(true)}>
          عكس مالي
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <label className="block text-sm font-semibold text-slate-700">
            سبب العكس (مطلوب)
            <Input
              className="mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: خطأ في كميات البند…"
            />
          </label>
          {reverseMutation.isError ? (
            <p className="text-sm text-red-700">{parseBlockedMessage(reverseMutation.error)}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button
              isLoading={reverseMutation.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => reverseMutation.mutate()}
            >
              تأكيد العكس
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
