'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SafeSelect } from '@/app/components/form/SafeSelect';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatDateAr, formatEgp } from '@/lib/subcontracts/money';

export type ContractingSettlementStatus = 'UNPAID' | 'PARTIALLY_SETTLED' | 'SETTLED';

export type ContractingSettlementSummary = {
  certificateAmount?: number;
  payableAmount?: number;
  collectedAmount?: number;
  paidAmount?: number;
  remainingAmount: number;
  settlementStatus: ContractingSettlementStatus;
  currencyCode: string;
  allocations: Array<{
    id: string;
    treasuryDocumentId: string;
    allocatedAmount: number;
    allocatedAt: string;
    active: boolean;
    cashTransaction?: {
      voucherNumber?: string | null;
      date?: string;
    };
  }>;
};

const STATUS_LABEL: Record<ContractingSettlementStatus, string> = {
  UNPAID: 'غير مسدد',
  PARTIALLY_SETTLED: 'مسدد جزئياً',
  SETTLED: 'مسدد بالكامل',
};

type Props = {
  mode: 'owner' | 'subcontractor';
  settlementPath: string;
  collectPath: string;
  collectLabel: string;
  amountLabel: string;
  onChanged?: () => void;
};

export function ContractingCertificateSettlementPanel({
  mode,
  settlementPath,
  collectPath,
  collectLabel,
  amountLabel,
  onChanged,
}: Props) {
  const [amount, setAmount] = useState('');
  const [safeId, setSafeId] = useState('');
  const [open, setOpen] = useState(false);
  /** One key per modal open / user submission; reused on network retry, not on new submission. */
  const submissionIdempotencyKeyRef = useRef<string | null>(null);

  const settlementQuery = useQuery({
    queryKey: ['contracting-settlement', settlementPath],
    queryFn: async () => {
      const res = await apiClient.get<ContractingSettlementSummary>(settlementPath);
      return res.data;
    },
  });

  const summary = settlementQuery.data;
  const eligible =
    mode === 'owner' ? summary?.certificateAmount ?? 0 : summary?.payableAmount ?? 0;
  const settled =
    mode === 'owner' ? summary?.collectedAmount ?? 0 : summary?.paidAmount ?? 0;

  const canCollect = useMemo(() => {
    if (!summary) return false;
    return summary.remainingAmount > 0.0001 && summary.settlementStatus !== 'SETTLED';
  }, [summary]);

  const collectMutation = useMutation({
    mutationFn: async () => {
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('أدخل مبلغاً صحيحاً');
      }
      if (!safeId) throw new Error('اختر الخزينة');
      const idempotencyKey = submissionIdempotencyKeyRef.current;
      if (!idempotencyKey) {
        throw new Error('مفتاح العملية غير جاهز — أعد فتح نافذة التحصيل');
      }
      return apiClient.post(collectPath, {
        amount: parsed,
        safeId,
        idempotencyKey,
      });
    },
    onSuccess: () => {
      notifyApiSuccess('تم تسجيل حركة الخزينة');
      setOpen(false);
      setAmount('');
      void settlementQuery.refetch();
      onChanged?.();
    },
  });

  if (settlementQuery.isLoading) {
    return <p className="text-sm text-slate-500">جاري تحميل حالة التحصيل…</p>;
  }

  if (!summary) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[#0E78AA]">تسوية الخزينة</h3>
        <span className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-[#094C6B]">
          {STATUS_LABEL[summary.settlementStatus]}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-slate-500">{amountLabel}</p>
          <p className="font-bold">{formatEgp(eligible)}</p>
        </div>
        <div>
          <p className="text-slate-500">{mode === 'owner' ? 'المحصل' : 'المدفوع'}</p>
          <p className="font-bold text-emerald-700">{formatEgp(settled)}</p>
        </div>
        <div>
          <p className="text-slate-500">المتبقي</p>
          <p className="font-bold text-amber-700">{formatEgp(summary.remainingAmount)}</p>
        </div>
      </div>

      {canCollect ? (
        <Button
          onClick={() => {
            submissionIdempotencyKeyRef.current = crypto.randomUUID();
            setOpen(true);
          }}
        >
          {collectLabel}
        </Button>
      ) : null}

      {summary.allocations.length ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-2 py-2 text-right">التاريخ</th>
                <th className="px-2 py-2 text-right">السند</th>
                <th className="px-2 py-2 text-right">المبلغ</th>
                <th className="px-2 py-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {summary.allocations.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{formatDateAr(row.allocatedAt)}</td>
                  <td className="px-2 py-2">
                    <Link
                      className="text-[#0E78AA] hover:underline"
                      href="/accounting/operations/treasury"
                    >
                      {row.cashTransaction?.voucherNumber ?? row.treasuryDocumentId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-2 py-2 font-semibold">{formatEgp(row.allocatedAmount)}</td>
                  <td className="px-2 py-2">{row.active ? 'فعّال' : 'غير فعّال (عكس/إلغاء)'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">لا توجد حركات تحصيل/سداد بعد.</p>
      )}

      {open ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-[#0E78AA]">{collectLabel}</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">المبلغ</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(summary.remainingAmount)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">الخزينة</label>
              <SafeSelect value={safeId} onChange={setSafeId} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button
                isLoading={collectMutation.isPending}
                disabled={collectMutation.isPending}
                onClick={() => collectMutation.mutate()}
              >
                تأكيد
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
