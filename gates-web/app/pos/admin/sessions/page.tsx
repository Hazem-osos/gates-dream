'use client';

import Link from 'next/link';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { PosAdminNav } from '@/components/pos/PosAdminNav';
import { useResourcePermissions } from '@/lib/hooks/useResourcePermissions';
import { formatMoneyAr } from '@/lib/formatMoney';

type SessionRow = {
  id: string;
  status: string;
  openedAt: string;
  openingCash: number;
  cashierName: string;
  terminalName: string;
  branchName: string;
  expectedCash: number;
  salesNet: number;
  refundsNet: number;
  cashIn: number;
  cashOut: number;
};
type CloseRow = {
  id: string;
  shiftId: string;
  terminalName: string;
  cashierId?: string | null;
  openedAt: string;
  closedAt: string;
  openingCash: number | string;
  expectedCash: number | string;
  countedCash: number | string;
  variance: number | string;
  reopenedAt?: string | null;
};

export default function PosSessionsAdminPage() {
  const sessions = useApiQuery<SessionRow[]>(['pos-open-sessions'], '/pos/admin/sessions');
  const closes = useApiQuery<CloseRow[]>(['pos-closes'], '/pos/admin/closes');
  const permissions = useResourcePermissions({ resource: 'pos', module: 'pos' });

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4" dir="rtl">
      <h1 className="text-xl font-bold">الورديات المفتوحة</h1>
      <PosAdminNav />
      {(sessions.data?.data ?? []).map((row) => (
        <article key={row.id} className="rounded-xl border bg-white p-3 text-sm">
          <p className="font-semibold">{row.terminalName} · {row.branchName} · {row.cashierName}</p>
          <p>فُتحت {new Date(row.openedAt).toLocaleString('ar-EG')} · الحالة {row.status}</p>
          <p>افتتاح {formatMoneyAr(row.openingCash)} · المتوقع {formatMoneyAr(row.expectedCash)}</p>
          <p>مبيعات {formatMoneyAr(row.salesNet)} · مرتجعات {formatMoneyAr(row.refundsNet)} · وارد {formatMoneyAr(row.cashIn)} · صادر {formatMoneyAr(row.cashOut)}</p>
          <Link href="/pos/session" className="text-sky-800">فتح شاشة الإقفال</Link>
        </article>
      ))}
      <h2 className="font-bold">لقطات الإقفال</h2>
      {(closes.data?.data ?? []).map((row) => (
        <article key={row.id} className="rounded-xl border bg-white p-3 text-sm">
          <p>{row.terminalName} · فرق {formatMoneyAr(Number(row.variance))} · متوقع {formatMoneyAr(Number(row.expectedCash))} · معدود {formatMoneyAr(Number(row.countedCash))}</p>
          <p>{row.reopenedAt ? `أُعيد فتحها ${new Date(row.reopenedAt).toLocaleString('ar-EG')}` : 'مغلقة'}</p>
          {permissions.can('reopen_shift') && !row.reopenedAt ? (
            <button type="button" className="rounded border px-3 py-1" onClick={() => void apiClient.post(`/pos/shifts/${row.shiftId}/reopen`, {}).then(() => closes.refetch())}>
              إعادة فتح
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
