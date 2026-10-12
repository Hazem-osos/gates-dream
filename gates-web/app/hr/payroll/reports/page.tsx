'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  PayrollReportDetailView,
  PayrollReportRegisterView,
  PayrollReportSummaryView,
} from '@/components/hr/payroll/PayrollReportViews';

const ROW_LEVEL_REPORTS = new Set([
  'register',
  'overtime',
  'absence-leave',
  'advance-recovery',
  'employer-contributions',
]);

const REPORTS = [
  { key: 'summary', label: 'ملخص المسيرة' },
  { key: 'register', label: 'سجل الرواتب' },
  { key: 'component-summary', label: 'ملخص المكونات' },
  { key: 'deduction-summary', label: 'ملخص الاستقطاعات' },
  { key: 'overtime', label: 'عمل إضافي' },
  { key: 'absence-leave', label: 'غياب وإجازات' },
  { key: 'advance-recovery', label: 'استرداد سلف' },
  { key: 'employer-contributions', label: 'مساهمات صاحب العمل' },
  { key: 'by-branch', label: 'حسب الفرع' },
  { key: 'by-department', label: 'حسب القسم' },
  { key: 'by-cost-center', label: 'حسب مركز التكلفة' },
  { key: 'reconciliation', label: 'تسوية محاسبية' },
];

export default function PayrollReportsPage() {
  const [runId, setRunId] = useState('');
  const [reportKey, setReportKey] = useState('summary');
  const [page, setPage] = useState(1);

  const report = useQuery({
    queryKey: ['payroll-report', runId, reportKey, page],
    enabled: Boolean(runId),
    queryFn: async () => {
      const qs = ROW_LEVEL_REPORTS.has(reportKey)
        ? `?page=${page}&pageSize=50`
        : '';
      const res = await apiClient.get<unknown>(
        `/hr/payroll/runs/${runId}/reports/${reportKey}${qs}`
      );
      return res.data;
    },
  });

  const exportCsv = () => {
    if (!runId) return;
    window.open(
      `/api/v1/hr/payroll/runs/${runId}/reports/register?format=csv&page=1&pageSize=500`,
      '_blank'
    );
  };

  const data = report.data;

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <h2 className="text-xl font-bold">تقارير الرواتب (PayrollRun)</h2>
      <div className="flex flex-wrap gap-3 items-end text-sm">
        <label>
          معرّف المسيرة
          <input
            className="border rounded px-2 py-1 mr-2 min-w-[240px]"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
          />
        </label>
        <label>
          التقرير
          <select
            className="border rounded px-2 py-1 mr-2"
            value={reportKey}
            onChange={(e) => {
              setReportKey(e.target.value);
              setPage(1);
            }}
          >
            {REPORTS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </label>
        {reportKey === 'register' && (
          <button type="button" className="rounded border px-3 py-1" onClick={exportCsv}>
            تصدير CSV
          </button>
        )}
        {ROW_LEVEL_REPORTS.has(reportKey) && reportKey !== 'register' && data && typeof data === 'object' && 'total' in (data as object) && (
          <div className="flex gap-2 items-center">
            <button type="button" className="border rounded px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              السابق
            </button>
            <span>صفحة {page}</span>
            <button type="button" className="border rounded px-2 py-1" onClick={() => setPage((p) => p + 1)}>
              التالي
            </button>
          </div>
        )}
      </div>

      {report.isError && (
        <p className="text-sm text-destructive">تعذر تحميل التقرير — تحقق من الصلاحيات أو المعرّف.</p>
      )}
      {report.isFetching && <p className="text-sm">جاري التحميل…</p>}
      {!report.isFetching && runId && data == null && !report.isError && (
        <p className="text-sm text-muted-foreground">لا توجد بيانات لهذه المسيرة.</p>
      )}

      {reportKey === 'summary' && data && (
        <PayrollReportSummaryView data={data as Parameters<typeof PayrollReportSummaryView>[0]['data']} />
      )}

      {reportKey === 'register' && data && (
        <PayrollReportRegisterView
          data={data as Parameters<typeof PayrollReportRegisterView>[0]['data']}
          runId={runId}
          page={page}
          onPageChange={setPage}
        />
      )}

      {data && reportKey !== 'summary' && reportKey !== 'register' && (
        <PayrollReportDetailView reportKey={reportKey} data={data} />
      )}
    </div>
  );
}
