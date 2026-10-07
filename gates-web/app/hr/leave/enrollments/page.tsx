'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

type Enrollment = {
  id: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  policy?: { code: string; arabicName: string };
  employment?: { episodeNumber: number; employee?: { arabicName: string } };
};

type Policy = { id: string; code: string; arabicName: string };
type Emp = { employmentId: string; label: string };

export default function LeaveEnrollmentsPage() {
  const { data, isLoading, refetch } = useApiQuery<Enrollment[]>(['leave-enrollments'], '/hr/leave/enrollments');
  const { data: policies } = useApiQuery<Policy[]>(['leave-policies'], '/hr/leave/policies');
  const { data: emps } = useApiQuery<Emp[]>(['leave-active-emps'], '/hr/leave/meta/active-employments');
  const rows = data?.data ?? [];
  const [employmentId, setEmploymentId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');

  const save = () => {
    void apiClient
      .post('/hr/leave/enrollments', { employmentId, policyId, effectiveFrom })
      .then(() => {
        toast.success('تم التسجيل');
        void refetch();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل'));
  };

  return (
    <HrPageChrome title="تسجيل سياسة الإجازة" onSave={save}>
      <FormSectionCard title="تسجيل جديد">
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <select className={compactControlClass} value={employmentId} onChange={(e) => setEmploymentId(e.target.value)}>
            <option value="">الموظف / الحلقة</option>
            {(emps?.data ?? []).map((e) => (
              <option key={e.employmentId} value={e.employmentId}>{e.label}</option>
            ))}
          </select>
          <select className={compactControlClass} value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
            <option value="">السياسة</option>
            {(policies?.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.arabicName}</option>
            ))}
          </select>
          <input type="date" className={compactControlClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </div>
      </FormSectionCard>
      <FormSectionCard title="التسجيلات" className="mt-4">
        {isLoading ? <p>جاري التحميل…</p> : (
          <ul className="text-sm space-y-1">
            {rows.map((r) => (
              <li key={r.id}>
                {r.employment?.employee?.arabicName} (حلقة {r.employment?.episodeNumber}) — {r.policy?.arabicName} من {r.effectiveFrom.slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </FormSectionCard>
    </HrPageChrome>
  );
}
