'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import { Button } from '@/components/ui';

type Summary = {
  customer: { id: string; name: string; arBalance: number };
  supplier: { id: string; name: string; apBalance: number };
  maxOffset: number;
};

type Props = {
  customerId: string;
  open: boolean;
  onClose: () => void;
  fiscalYearId: string;
  onSuccess?: () => void;
};

export function CounterpartyOffsetModal({
  customerId,
  open,
  onClose,
  fiscalYearId,
  onSuccess,
}: Props) {
  const { companyId } = useFirstCompany();
  const [amount, setAmount] = useState('');
  const [voucher, setVoucher] = useState<Record<string, unknown> | null>(null);

  const { data: summaryRes, isLoading } = useApiQuery<Summary>(
    ['counterparty-summary', customerId],
    `/accounting/counterparty-offset/${customerId}/summary`,
    undefined,
    { enabled: open && Boolean(customerId) }
  );
  const summary = summaryRes?.data;

  const execute = useMutation({
    mutationFn: async () => {
      const num = Number(amount);
      if (!Number.isFinite(num) || num <= 0) throw new Error('أدخل مبلغاً صحيحاً');
      return apiClient.post('/accounting/counterparty-offset', {
        customerId,
        amount: num,
        fiscalYearId,
      });
    },
    onSuccess: (res) => {
      setVoucher((res.data ?? null) as Record<string, unknown> | null);
      onSuccess?.();
    },
  });

  if (!open) return null;

  const max = summary?.maxOffset ?? 0;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-[#0E79AA]">مقاصة وتسوية ثنائية</h2>
        {isLoading && <p className="text-sm text-gray-500">جاري التحميل…</p>}
        {summary && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-[#F6FBFD] p-3">
              <div className="text-gray-600">رصيد العميل (لنا)</div>
              <div className="text-lg font-bold">{summary.customer.arBalance.toFixed(2)} ج.م</div>
            </div>
            <div className="rounded-lg bg-[#F6FBFD] p-3">
              <div className="text-gray-600">رصيد المورد (علينا)</div>
              <div className="text-lg font-bold">{summary.supplier.apBalance.toFixed(2)} ج.م</div>
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">مبلغ المقاصة (حد أقصى {max.toFixed(2)})</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={max > 0 ? String(max) : '0'}
          />
        </div>
        {voucher && (
          <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="font-semibold">تم تنفيذ سند التسوية</div>
            <div>رقم: {String(voucher.voucherNumber ?? '—')}</div>
            <div>المبلغ: {Number(voucher.amount ?? 0).toFixed(2)} ج.م</div>
          </div>
        )}
        {execute.isError && (
          <p className="text-red-600 text-sm">
            {execute.error instanceof Error ? execute.error.message : 'فشل التنفيذ'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          {!voucher && (
            <Button
              type="button"
              isLoading={execute.isPending}
              disabled={!companyId}
              onClick={() => execute.mutate()}
            >
              تنفيذ المقاصة
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
