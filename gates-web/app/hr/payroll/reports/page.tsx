'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  PayrollReportDetailView,
  PayrollReportRegisterView,
  PayrollReportSummaryView,
} from '@/components/hr/payroll/PayrollReportViews';
import { payrollReportQueryString, type PayrollReportFilters } from '@/lib/hr/payroll-report-query';

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

const DEFAULT_FILTERS: PayrollReportFilters = {
  page: 1,
  pageSize: 50,
  employmentStatus: 'all',
  sortBy: 'employeeName',
  sortOrder: 'asc',
};

export default function PayrollReportsPage() {
  const [runId, setRunId] = useState('');
  const [reportKey, setReportKey] = useState('summary');
  const [filters, setFilters] = useState<PayrollReportFilters>(DEFAULT_FILTERS);
  const [runListPage, setRunListPage] = useState(1);
  const [runStatusFilter, setRunStatusFilter] = useState('');
  const [runPeriodYear, setRunPeriodYear] = useState('');
  const [runPeriodMonth, setRunPeriodMonth] = useState('');
  const [excludeDraftCancelled, setExcludeDraftCancelled] = useState(true);

  const runListQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(runListPage));
    params.set('pageSize', '15');
    if (runPeriodYear) params.set('periodYear', runPeriodYear);
    if (runPeriodMonth) params.set('periodMonth', runPeriodMonth);
    if (runStatusFilter) params.set('status', runStatusFilter);
    else if (excludeDraftCancelled) params.set('statusNotIn', 'DRAFT,CANCELLED');
    return params.toString();
  }, [runListPage, runPeriodYear, runPeriodMonth, runStatusFilter, excludeDraftCancelled]);

  const runs = useQuery({
    queryKey: ['payroll-runs-list', runListQuery],
    queryFn: async () => {
      const res = await apiClient.get<{
        rows: Array<{ id: string; periodYear: number; periodMonth: number; status: string; employeeCount: number }>;
        total: number;
        totalPages: number;
        page: number;
      }>(`/hr/payroll/runs?${runListQuery}`);
      return res.data;
    },
  });

  const reportQs = payrollReportQueryString(
    ROW_LEVEL_REPORTS.has(reportKey) ? filters : { ...filters, page: undefined, pageSize: undefined }
  );

  const report = useQuery({
    queryKey: ['payroll-report', runId, reportKey, reportQs],
    enabled: Boolean(runId),
    queryFn: async () => {
      const res = await apiClient.get<unknown>(
        `/hr/payroll/runs/${runId}/reports/${reportKey}${reportQs}`
      );
      return res.data;
    },
  });

  useEffect(() => {
    setFilters((f) => ({ ...f, page: 1 }));
  }, [
    filters.search,
    filters.employeeId,
    filters.branchId,
    filters.departmentId,
    filters.costCenterId,
    filters.employmentStatus,
    filters.sortBy,
    filters.sortOrder,
    reportKey,
    runId,
  ]);

  const exportCsv = () => {
    if (!runId) return;
    const qs = payrollReportQueryString(filters, { exportAll: true });
    const base = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
    window.open(`${base}/hr/payroll/runs/${runId}/reports/register${qs}&format=csv`, '_blank');
  };

  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const data = report.data;
  const paginationMeta =
    data && typeof data === 'object' && 'total' in data
      ? (data as { page?: number; pageSize?: number; total?: number; totalPages?: number })
      : null;

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <main>
        <h1 className="text-xl font-bold">تقارير الرواتب</h1>
        <p className="text-sm text-muted-foreground">فلترة وترقيم من الخادم — الإجماليات على مجموعة النتائج كاملة.</p>
      </main>

      <section className="border rounded p-4 text-sm space-y-3" data-testid="payroll-run-picker">
        <h2 className="font-semibold">اختيار المسيرة</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block">
            سنة الفترة
            <input
              className="border rounded px-2 py-1 mt-1 w-24"
              inputMode="numeric"
              value={runPeriodYear}
              onChange={(e) => {
                setRunPeriodYear(e.target.value);
                setRunListPage(1);
              }}
            />
          </label>
          <label className="block">
            شهر الفترة
            <input
              className="border rounded px-2 py-1 mt-1 w-20"
              inputMode="numeric"
              value={runPeriodMonth}
              onChange={(e) => {
                setRunPeriodMonth(e.target.value);
                setRunListPage(1);
              }}
            />
          </label>
          <label className="block">
            حالة المسيرة
            <select
              className="border rounded px-2 py-1 mt-1"
              value={runStatusFilter}
              onChange={(e) => {
                setRunStatusFilter(e.target.value);
                setRunListPage(1);
              }}
            >
              <option value="">(افتراضي)</option>
              <option value="DRAFT">مسودة</option>
              <option value="CALCULATED">محسوبة</option>
              <option value="APPROVED">معتمدة</option>
              <option value="POSTED">مرحّلة</option>
              <option value="PAID">مدفوعة</option>
              <option value="CANCELLED">ملغاة</option>
            </select>
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={excludeDraftCancelled && !runStatusFilter}
              disabled={Boolean(runStatusFilter)}
              onChange={(e) => {
                setExcludeDraftCancelled(e.target.checked);
                setRunListPage(1);
              }}
            />
            إخفاء المسودة والملغاة
          </label>
        </div>
        {runs.isLoading && <p className="text-muted-foreground">جاري تحميل المسارات…</p>}
        {runs.isError && <p className="text-destructive">تعذر تحميل قائمة المسارات.</p>}
        {runs.data && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border min-w-[640px]">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-right">الفترة</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">الموظفون</th>
                  <th className="p-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {runs.data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground">لا توجد مسارات</td>
                  </tr>
                ) : (
                  runs.data.rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t cursor-pointer hover:bg-muted/40 ${runId === r.id ? 'bg-muted/30' : ''}`}
                      onClick={() => setRunId(r.id)}
                    >
                      <td className="p-2">{r.periodYear}-{String(r.periodMonth).padStart(2, '0')}</td>
                      <td className="p-2">{r.status}</td>
                      <td className="p-2">{r.employeeCount}</td>
                      <td className="p-2">
                        <button type="button" className="underline" onClick={() => setRunId(r.id)}>اختيار</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="flex gap-2 mt-2 items-center">
              <button
                type="button"
                className="border rounded px-2 py-1 disabled:opacity-50"
                disabled={runListPage <= 1}
                onClick={() => setRunListPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </button>
              <span>
                صفحة {runs.data.page} من {runs.data.totalPages || 1} ({runs.data.total} مسيرة)
              </span>
              <button
                type="button"
                className="border rounded px-2 py-1 disabled:opacity-50"
                disabled={runListPage >= (runs.data.totalPages || 1)}
                onClick={() => setRunListPage((p) => p + 1)}
              >
                التالي
              </button>
            </div>
          </div>
        )}
        <label className="block">
          معرّف المسيرة (يدوي)
          <input
            className="border rounded px-2 py-1 mt-1 min-w-[280px] font-mono text-xs"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
          />
        </label>
      </section>

      <section className="border rounded p-4 text-sm space-y-3" data-testid="payroll-report-filters">
        <div className="flex flex-wrap gap-3 items-end">
          <label>
            التقرير
            <select
              className="border rounded px-2 py-1 mr-2 mt-1 block"
              value={reportKey}
              onChange={(e) => setReportKey(e.target.value)}
            >
              {REPORTS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </label>
          {ROW_LEVEL_REPORTS.has(reportKey) && (
            <>
              <label className="block">
                بحث (اسم / رقم)
                <input
                  className="border rounded px-2 py-1 mt-1 min-w-[160px]"
                  value={filters.search ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </label>
              <label className="block">
                موظف (معرّف)
                <input
                  className="border rounded px-2 py-1 mt-1 min-w-[200px] font-mono text-xs"
                  value={filters.employeeId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}
                />
              </label>
              <label className="block">
                فرع (معرّف)
                <input
                  className="border rounded px-2 py-1 mt-1 w-40 font-mono text-xs"
                  value={filters.branchId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value }))}
                />
              </label>
              <label className="block">
                قسم (معرّف)
                <input
                  className="border rounded px-2 py-1 mt-1 w-40 font-mono text-xs"
                  value={filters.departmentId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
                />
              </label>
              <label className="block">
                حالة التوظيف
                <select
                  className="border rounded px-2 py-1 mt-1 block"
                  value={filters.employmentStatus ?? 'all'}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      employmentStatus: e.target.value as PayrollReportFilters['employmentStatus'],
                    }))
                  }
                >
                  <option value="all">الكل</option>
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </label>
              <label className="block">
                ترتيب
                <select
                  className="border rounded px-2 py-1 mt-1 block"
                  value={filters.sortBy ?? 'employeeName'}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, sortBy: e.target.value as PayrollReportFilters['sortBy'] }))
                  }
                >
                  <option value="employeeName">الاسم</option>
                  <option value="serial">الرقم</option>
                  <option value="gross">الإجمالي</option>
                  <option value="net">الصافي</option>
                </select>
              </label>
              <label className="block">
                اتجاه
                <select
                  className="border rounded px-2 py-1 mt-1 block"
                  value={filters.sortOrder ?? 'asc'}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      sortOrder: e.target.value as PayrollReportFilters['sortOrder'],
                    }))
                  }
                >
                  <option value="asc">تصاعدي</option>
                  <option value="desc">تنازلي</option>
                </select>
              </label>
              <button type="button" className="rounded border px-3 py-1 mt-6" onClick={resetFilters}>
                مسح الفلاتر
              </button>
            </>
          )}
          {reportKey === 'register' && (
            <button type="button" className="rounded border px-3 py-1 mt-6" disabled={!runId} onClick={exportCsv}>
              تصدير CSV (كامل الفلتر)
            </button>
          )}
        </div>
      </section>

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
          page={filters.page ?? 1}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
        />
      )}

      {data && reportKey !== 'summary' && reportKey !== 'register' && (
        <PayrollReportDetailView
          reportKey={reportKey}
          data={data}
          pagination={
            ROW_LEVEL_REPORTS.has(reportKey) && paginationMeta
              ? {
                  page: paginationMeta.page ?? 1,
                  totalPages: paginationMeta.totalPages ?? 1,
                  total: paginationMeta.total ?? 0,
                  onPageChange: (p) => setFilters((f) => ({ ...f, page: p })),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
