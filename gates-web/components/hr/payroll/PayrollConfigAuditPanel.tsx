'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export type ConfigAuditSubject =
  | 'HCM_PAYROLL_RULE'
  | 'HCM_PAYROLL_LOCALIZATION'
  | 'HCM_PAYROLL_GL_MAPPING'
  | '';

export type AuditRow = {
  id: string;
  at: string;
  actorId: string;
  subjectType?: string;
  subjectId: string;
  action: string;
  summary: string;
  entityCode?: string | null;
};

const SUBJECT_LABEL: Record<string, string> = {
  HCM_PAYROLL_RULE: 'قواعد',
  HCM_PAYROLL_LOCALIZATION: 'توطين',
  HCM_PAYROLL_GL_MAPPING: 'ربط GL',
};

export function PayrollConfigAuditPanel({
  subjectType,
  subjectId,
  title = 'سجل التغييرات',
  limit = 20,
  compact = true,
}: {
  subjectType?: ConfigAuditSubject;
  subjectId?: string;
  title?: string;
  limit?: number;
  compact?: boolean;
}) {
  const qs = new URLSearchParams();
  if (subjectType) qs.set('subjectType', subjectType);
  if (subjectId) qs.set('subjectId', subjectId);
  qs.set('limit', String(limit));

  const audit = useQuery({
    queryKey: ['payroll-config-audit', subjectType, subjectId, limit],
    queryFn: async () => {
      const res = await apiClient.get<AuditRow[]>(`/hr/payroll/config-audit?${qs.toString()}`);
      return res.data ?? [];
    },
  });

  return (
    <section className={`border rounded p-4 text-sm ${compact ? '' : 'space-y-3'}`} data-testid="config-audit-panel">
      <h3 className="font-semibold mb-2">{title}</h3>
      {audit.isLoading && <p className="text-muted-foreground">جاري التحميل…</p>}
      {audit.isError && <p className="text-destructive text-xs">تعذر تحميل السجل.</p>}
      {!audit.isLoading && !audit.isError && (audit.data ?? []).length === 0 && (
        <p className="text-muted-foreground text-xs">لا توجد أحداث مسجّلة.</p>
      )}
      <ul className={`text-xs space-y-1 ${compact ? 'max-h-32 overflow-auto' : ''}`}>
        {(audit.data ?? []).map((a) => (
          <li key={a.id}>
            {a.at} · {a.action} ·{' '}
            {a.subjectType ? SUBJECT_LABEL[a.subjectType] ?? a.subjectType : ''}{' '}
            {a.entityCode ? `(${a.entityCode})` : ''} · {a.summary}
          </li>
        ))}
      </ul>
    </section>
  );
}
