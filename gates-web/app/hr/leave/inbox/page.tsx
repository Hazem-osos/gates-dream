'use client';

import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type InboxRow = {
  id: string;
  employee?: { arabicName: string };
  leaveType?: { arabicName: string };
  startDate: string;
  endDate: string;
  chargeableQuantity: string;
  balance: { available: string; reserved: string };
  teamOverlapCount: number;
  reason?: string | null;
  submittedAt?: string | null;
};

export default function LeaveInboxPage() {
  const { data, isLoading, refetch } = useApiQuery<InboxRow[]>(['leave-inbox'], '/hr/leave/requests/inbox');
  const rows = data?.data ?? [];

  const act = (id: string, action: 'approve' | 'reject') => {
    void apiClient
      .post(`/hr/leave/requests/${id}/${action}`, action === 'reject' ? { reason: 'مرفوض' } : {})
      .then(() => {
        toast.success(action === 'approve' ? 'تم الاعتماد' : 'تم الرفض');
        void refetch();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل'));
  };

  return (
    <HrPageChrome title="صندوق اعتماد الإجازات">
      <FormSectionCard title="طلبات قيد الاعتماد">
        {isLoading ? (
          <p className="text-sm">جاري التحميل…</p>
        ) : (
          <ul className="text-sm space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="border rounded p-3">
                <div className="font-medium">{r.employee?.arabicName} — {r.leaveType?.arabicName}</div>
                <div>{r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} · {r.chargeableQuantity} يوم</div>
                <div>متاح: {r.balance.available} · محجوز: {r.balance.reserved} · تعارض الفريق: {r.teamOverlapCount}</div>
                {r.reason && <div className="text-muted-foreground">{r.reason}</div>}
                <div className="mt-2 flex gap-2">
                  <button type="button" className="text-xs underline" onClick={() => act(r.id, 'approve')}>اعتماد</button>
                  <button type="button" className="text-xs underline" onClick={() => act(r.id, 'reject')}>رفض</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
