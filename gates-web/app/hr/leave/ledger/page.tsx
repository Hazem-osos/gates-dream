'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

type LedgerRow = {
  id: string;
  effectiveDate: string;
  transactionType: string;
  quantity: string;
  sourceKey: string;
  reason?: string | null;
  leaveType?: { code: string };
};

type Balance = {
  available: string;
  reserved: string;
  taken: string;
  entitled: string;
  accrued: string;
  expired: string;
  encashed: string;
};

export default function LeaveLedgerPage() {
  const [employmentId, setEmploymentId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const { data: emps } = useApiQuery<{ employmentId: string; label: string }[]>(
    ['leave-active-emps'],
    '/hr/leave/meta/active-employments'
  );
  const { data: types } = useApiQuery<{ id: string; code: string; arabicName: string }[]>(['leave-types'], '/hr/leave/types');
  const ledgerUrl = employmentId
    ? `/hr/leave/ledger/${employmentId}${leaveTypeId ? `?leaveTypeId=${leaveTypeId}` : ''}`
    : '/hr/leave/types';
  const { data: ledger, isLoading } = useApiQuery<LedgerRow[]>(
    ['leave-ledger', employmentId, leaveTypeId],
    ledgerUrl,
    undefined,
    { enabled: Boolean(employmentId) }
  );
  const balUrl =
    employmentId && leaveTypeId ? `/hr/leave/balance/${employmentId}/${leaveTypeId}` : '/hr/leave/types';
  const { data: bal } = useApiQuery<Balance>(
    ['leave-bal', employmentId, leaveTypeId],
    balUrl,
    undefined,
    { enabled: Boolean(employmentId && leaveTypeId) }
  );

  return (
    <HrPageChrome title="سجل الإجازات">
      <FormSectionCard title="تصفية">
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <select className={compactControlClass} value={employmentId} onChange={(e) => setEmploymentId(e.target.value)}>
            <option value="">الموظف</option>
            {(emps?.data ?? []).map((e) => (
              <option key={e.employmentId} value={e.employmentId}>{e.label}</option>
            ))}
          </select>
          <select className={compactControlClass} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            <option value="">نوع الإجازة</option>
            {(types?.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.arabicName}</option>
            ))}
          </select>
        </div>
        {bal?.data && (
          <div className="mt-3 grid gap-2 sm:grid-cols-4 text-xs">
            <div>متاح: {bal.data.available}</div>
            <div>محجوز: {bal.data.reserved}</div>
            <div>مستخدم: {bal.data.taken}</div>
            <div>منتهي: {bal.data.expired}</div>
          </div>
        )}
      </FormSectionCard>
      <FormSectionCard title="الحركات" className="mt-4">
        {isLoading ? <p>جاري التحميل…</p> : (
          <table className="w-full text-xs">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>المصدر</th></tr></thead>
            <tbody>
              {(ledger?.data ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td>{r.effectiveDate.slice(0, 10)}</td>
                  <td>{r.transactionType}</td>
                  <td>{r.quantity}</td>
                  <td className="truncate max-w-[120px]">{r.sourceKey}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
