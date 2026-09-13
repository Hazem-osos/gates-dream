'use client';

import { Sparkles } from 'lucide-react';
import { askGatesAi } from '@/lib/ai/ask-screen-help';
import { usePartyQuickSummary } from '@/lib/hooks/usePartyQuickSummary';

function formatBalance(balance: number): string {
  const abs = Math.abs(balance).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (balance > 0) return `${abs} ج.م مديونية`;
  if (balance < 0) return `${abs} ج.م دائنية`;
  return `${abs} ج.م`;
}

export function CustomerBalanceInspector({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName?: string;
}) {
  const { data, isLoading } = usePartyQuickSummary(customerId, 'CUSTOMER', Boolean(customerId));
  const summary = data?.data;
  const name = summary?.displayName || customerName || 'العميل';

  const inspect = () => {
    askGatesAi(
      `اشرح لي باختصار تفاصيل رصيد العميل ${name} (رقم ${customerId})، وآخر 3 فواتير وسندات سداد أثرت في هذا الرقم. استخدم customer_aging_tool لهذا العميل.`
    );
  };

  return (
    <div className="mt-1.5 space-y-1 text-[11px] text-slate-600">
      <p>
        الرصيد الحالي:{' '}
        <span className="font-semibold tabular-nums text-[#0A3D5E]">
          {isLoading ? '…' : summary ? formatBalance(summary.balance) : '—'}
        </span>
      </p>
      <button
        type="button"
        onClick={inspect}
        className="inline-flex items-center gap-1 font-semibold text-[#0E79AA] hover:underline"
      >
        <Sparkles className="h-3 w-3" />
        كشف تفاصيل الرصيد بالذكاء الاصطناعي
      </button>
    </div>
  );
}
