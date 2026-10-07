'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

export default function LeaveAdjustmentsPage() {
  const { data: emps } = useApiQuery<{ employmentId: string; label: string }[]>(
    ['leave-active-emps'],
    '/hr/leave/meta/active-employments'
  );
  const { data: types } = useApiQuery<{ id: string; arabicName: string }[]>(['leave-types'], '/hr/leave/types');
  const [employmentId, setEmploymentId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [credit, setCredit] = useState(true);
  const [quantity, setQuantity] = useState('1');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');

  const submit = () => {
    void apiClient
      .post('/hr/leave/adjustments', { employmentId, leaveTypeId, credit, quantity, effectiveDate, reason })
      .then(() => toast.success('تم التسجيل في السجل'))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل'));
  };

  return (
    <HrPageChrome title="تسويات رصيد الإجازة" onSave={submit}>
      <FormSectionCard title="تسوية يدوية">
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
          <select className={compactControlClass} value={credit ? 'credit' : 'debit'} onChange={(e) => setCredit(e.target.value === 'credit')}>
            <option value="credit">إضافة</option>
            <option value="debit">خصم</option>
          </select>
          <input className={compactControlClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="الكمية" />
          <input type="date" className={compactControlClass} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          <input className={compactControlClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="السبب" />
        </div>
      </FormSectionCard>
    </HrPageChrome>
  );
}
