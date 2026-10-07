'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

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

type RegisterReport = {
  rows: Array<{ employeeId: string; employeeName: string; serial?: string; grossSalary: number; netSalary: number }>;
  totals?: { gross: number; net: number };
  page?: number;
  pageSize?: number;
  total?: number;
};

type SummaryReport = {
  totals: { gross: number; net: number; employerContributions: number };
  employeeCount: number;
};

export default function PayrollReportsPage() {
  const [runId, setRunId] = useState('');
  const [reportKey, setReportKey] = useState('summary');
  const [page, setPage] = useState(1);

  const report = useQuery({
    queryKey: ['payroll-report', runId, reportKey, page],
    enabled: Boolean(runId),
    queryFn: async () => {
      const qs =
        reportKey === 'register' ? `?page=${page}&pageSize=50` : '';
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
      </div>

      {report.isError && (
        <p className="text-sm text-destructive">تعذر تحميل التقرير — تحقق من الصلاحيات أو المعرّف.</p>
      )}
      {report.isFetching && <p className="text-sm">جاري التحميل…</p>}

      {reportKey === 'summary' && data && (
        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <div className="border rounded p-3">
            الإجمالي: {(data as SummaryReport).totals.gross.toLocaleString()}
          </div>
          <div className="border rounded p-3">
            الصافي: {(data as SummaryReport).totals.net.toLocaleString()}
          </div>
          <div className="border rounded p-3">
            مساهمات ER: {(data as SummaryReport).totals.employerContributions.toLocaleString()}
          </div>
          <div className="border rounded p-3">
            الموظفون: {(data as SummaryReport).employeeCount}
          </div>
        </div>
      )}

      {reportKey === 'register' && data && (
        <>
          <div className="text-sm text-muted-foreground">
            إجمالي السجل: {(data as RegisterReport).totals?.gross?.toLocaleString()} صافي{' '}
            {(data as RegisterReport).totals?.net?.toLocaleString()}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border min-w-[640px]">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-right">الرقم</th>
                  <th className="p-2 text-right">الموظف</th>
                  <th className="p-2 text-right">الإجمالي</th>
                  <th className="p-2 text-right">الصافي</th>
                  <th className="p-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {(data as RegisterReport).rows.map((row) => (
                  <tr key={row.employeeId} className="border-t">
                    <td className="p-2">{row.serial ?? '—'}</td>
                    <td className="p-2">{row.employeeName}</td>
                    <td className="p-2">{row.grossSalary.toLocaleString()}</td>
                    <td className="p-2">{row.netSalary.toLocaleString()}</td>
                    <td className="p-2">
                      <Link className="underline" href={`/hr/payroll/runs/${runId}/payslip/${row.employeeId}`}>
                        قسيمة
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 text-sm">
            <button type="button" className="border rounded px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              السابق
            </button>
            <span>صفحة {page}</span>
            <button type="button" className="border rounded px-2" onClick={() => setPage((p) => p + 1)}>
              التالي
            </button>
          </div>
        </>
      )}

      {data && reportKey !== 'summary' && reportKey !== 'register' && (
        <div className="overflow-x-auto">
          <pre className="text-xs bg-muted p-3 rounded max-h-[480px] overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
