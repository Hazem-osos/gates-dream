'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { AuditRow, ConfigAuditSubject } from '@/components/hr/payroll/PayrollConfigAuditPanel';

const SUBJECT_OPTIONS: Array<{ value: ConfigAuditSubject; label: string }> = [
  { value: '', label: 'كل الأنواع' },
  { value: 'HCM_PAYROLL_RULE', label: 'قواعد الرواتب' },
  { value: 'HCM_PAYROLL_LOCALIZATION', label: 'التوطين' },
  { value: 'HCM_PAYROLL_GL_MAPPING', label: 'ربط الحسابات (GL)' },
];

export default function PayrollConfigAuditPage() {
  const [subjectType, setSubjectType] = useState<ConfigAuditSubject>('');
  const [subjectId, setSubjectId] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['payroll-config-audit-page', subjectType, subjectId, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '25');
      if (subjectType) params.set('subjectType', subjectType);
      if (subjectId.trim()) params.set('subjectId', subjectId.trim());
      const res = await apiClient.get<{
        rows: AuditRow[];
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      }>(`/hr/payroll/config-audit?${params.toString()}`);
      return res.data;
    },
  });

  const resetFilters = () => {
    setSubjectType('');
    setSubjectId('');
    setPage(1);
  };

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <main>
        <h1 className="text-xl font-bold">سجل تدقيق إعدادات الرواتب</h1>
        <p className="text-sm text-muted-foreground">
          قواعد، توطين، وربط GL — للقراءة فقط؛ التغييرات تُسجّل عند الحفظ.
        </p>
      </main>

      <section className="border rounded p-4 text-sm flex flex-wrap gap-3 items-end" data-testid="config-audit-filters">
        <label className="block">
          النوع
          <select
            className="border rounded px-2 py-1 mt-1 block min-w-[160px]"
            value={subjectType}
            onChange={(e) => {
              setSubjectType(e.target.value as ConfigAuditSubject);
              setPage(1);
            }}
          >
            {SUBJECT_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          معرّف السجل
          <input
            className="border rounded px-2 py-1 mt-1 font-mono text-xs min-w-[240px]"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <button type="button" className="rounded border px-3 py-1" onClick={resetFilters}>
          مسح الفلاتر
        </button>
      </section>

      {query.isLoading && <p>جاري التحميل…</p>}
      {query.isError && <p className="text-destructive text-sm">تعذر تحميل السجل (403؟).</p>}

      {query.data && (
        <>
          <p className="text-xs text-muted-foreground">
            {query.data.total} حدث · صفحة {query.data.page} من {query.data.totalPages || 1}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border min-w-[720px]">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-right">الوقت</th>
                  <th className="p-2 text-right">الإجراء</th>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">الكود</th>
                  <th className="p-2 text-right">الملخص</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">لا توجد أحداث</td>
                  </tr>
                ) : (
                  query.data.rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2 text-xs whitespace-nowrap">{String(row.at)}</td>
                      <td className="p-2">{row.action}</td>
                      <td className="p-2 text-xs">{row.subjectType}</td>
                      <td className="p-2 font-mono text-xs">{row.entityCode ?? '—'}</td>
                      <td className="p-2">{row.summary}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 items-center text-sm">
            <button
              type="button"
              className="border rounded px-2 py-1 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              السابق
            </button>
            <button
              type="button"
              className="border rounded px-2 py-1 disabled:opacity-50"
              disabled={page >= (query.data.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
            </button>
          </div>
        </>
      )}
    </div>
  );
}
