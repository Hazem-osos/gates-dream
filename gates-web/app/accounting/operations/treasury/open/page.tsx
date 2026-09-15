'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { hrefForCashTransaction } from '@/lib/accounting/journal-source';

type CashTxRow = {
  id: string;
  documentRole?: string | null;
  transactionKind?: string | null;
  safeId?: string | null;
  bankAccountId?: string | null;
};

export default function TreasuryOpenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id')?.trim() || '';

  useEffect(() => {
    if (!id) {
      router.replace('/accounting/operations/treasury/payment-voucher');
      return;
    }

    let cancelled = false;
    apiClient
      .get<CashTxRow>(`/treasury/cash-transactions/${id}`)
      .then((res) => {
        if (cancelled) return;
        const row = res.data;
        if (!row?.id) {
          router.replace('/accounting/operations/treasury/payment-voucher');
          return;
        }
        router.replace(hrefForCashTransaction(row));
      })
      .catch(() => {
        if (!cancelled) {
          router.replace(`/accounting/operations/treasury/payment-voucher?id=${encodeURIComponent(id)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return <p className="p-6 text-sm text-slate-500">جاري فتح المستند الأصلي…</p>;
}
