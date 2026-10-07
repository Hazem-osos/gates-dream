'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';

type Preview = {
  periodYear: number;
  periodMonth: number;
  engineMode: string;
  totalEmployees: number;
  ready: number;
  blocked: number;
  amountsRedacted?: boolean;
  totals: {
    gross: number;
    net: number;
    deductions: number;
    employerContributions: number;
  } | null;
  blockers: Array<{
    employeeId: string;
    employeeName?: string;
    serial?: string | null;
    category: string;
    messages: string[];
  }>;
};

export default function PayrollRunsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [periodYear, setPeriodYear] = useState(now.getUTCFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getUTCMonth() + 1);
  const [page, setPage] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [blockerFilter, setBlockerFilter] = useState<string | 'ALL'>('ALL');
  const [showCreate, setShowCreate] = useState(false);

  const createCtx = useQuery({
    queryKey: ['payroll-create-ctx', periodYear, periodMonth],
    enabled: showCreate,
    queryFn: async () => {
      const res = await apiClient.get<{
        engineMode: string;
        configuredMode: string;
        employeeCount: number;
        duplicateRunId: string | null;
      }>(`/hr/payroll/runs/create-context?periodYear=${periodYear}&periodMonth=${periodMonth}`);
      return res.data;
    },
  });

  const list = useQuery({
    queryKey: ['payroll-runs-list', periodYear, page],
    queryFn: async () => {
      const res = await apiClient.get<{
        rows: Array<{
          id: string;
          periodYear: number;
          periodMonth: number;
          status: string;
          employeeCount: number;
          gross: number | null;
          net: number | null;
        }>;
        total: number;
      }>(`/hr/payroll/runs?periodYear=${periodYear}&page=${page}&pageSize=20`);
      return res.data;
    },
  });

  const preview = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<Preview>('/hr/payroll/runs/preview', {
        periodYear,
        periodMonth,
      });
      return res.data;
    },
  });

  const calculateAsync = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ jobId: string }>('/hr/payroll-runs/calculate-async', {
        periodYear,
        periodMonth,
      });
      return res.data;
    },
    onSuccess: (d) => setJobId(d?.jobId ?? null),
  });

  const jobStatus = useQuery({
    queryKey: ['payroll-job', jobId],
    enabled: Boolean(jobId),
    refetchInterval: 2000,
    queryFn: async () => {
      const res = await apiClient.get<{ state: string; progress: number; failedReason?: string }>(
        `/hr/payroll-runs/calculate-async/${jobId}`
      );
      return res.data;
    },
  });

  const calculateSync = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ id: string }>('/hr/payroll-runs', { periodYear, periodMonth });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs-list'] });
      setShowCreate(false);
    },
  });

  const filteredBlockers = useMemo(() => {
    const blockers = preview.data?.blockers ?? [];
    if (blockerFilter === 'ALL') return blockers;
    return blockers.filter((b) => b.category === blockerFilter);
  }, [preview.data, blockerFilter]);

  const categories = useMemo(() => {
    const set = new Set((preview.data?.blockers ?? []).map((b) => b.category));
    return [...set];
  }, [preview.data]);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold">مسيرات الرواتب</h2>
        <button type="button" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'إخفاء إنشاء مسيرة' : 'إنشاء مسيرة'}
        </button>
      </div>

      {showCreate && (
        <section className="border rounded p-4 space-y-3 text-sm bg-muted/20">
          <h3 className="font-semibold">تهيئة المسيرة</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <label>
              السنة
              <input className="border rounded px-2 py-1 mr-2" type="number" value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} />
            </label>
            <label>
              الشهر
              <input className="border rounded px-2 py-1 mr-2" type="number" min={1} max={12} value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))} />
            </label>
          </div>
          {createCtx.data && (
            <div className="grid md:grid-cols-3 gap-2">
              <div>وضع المحرك: {createCtx.data.engineMode}</div>
              <div>إعداد الشركة: {createCtx.data.configuredMode}</div>
              <div>عدد الموظفين المؤهلون: {createCtx.data.employeeCount}</div>
              {createCtx.data.duplicateRunId && (
                <div className="text-amber-700 md:col-span-3">
                  يوجد مسيرة لهذه الفترة —{' '}
                  <Link className="underline" href={`/hr/payroll/runs/${createCtx.data.duplicateRunId}`}>
                    فتح المسيرة الحالية
                  </Link>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border px-3 py-1.5" onClick={() => preview.mutate()} disabled={preview.isPending}>
              معاينة (بدون آثار جانبية)
            </button>
            <button type="button" className="rounded border px-3 py-1.5" onClick={() => calculateAsync.mutate()} disabled={calculateAsync.isPending || Boolean(createCtx.data?.duplicateRunId)}>
              احسب (خلفية)
            </button>
            <button type="button" className="rounded border px-3 py-1.5" onClick={() => calculateSync.mutate()} disabled={calculateSync.isPending || Boolean(createCtx.data?.duplicateRunId)}>
              احسب (مباشر)
            </button>
          </div>
        </section>
      )}

      {preview.data && (
        <section className="text-sm border rounded p-4 space-y-3">
          <div className="font-medium">معاينة الفترة {preview.data.periodYear}-{String(preview.data.periodMonth).padStart(2, '0')}</div>
          <div className="grid md:grid-cols-5 gap-2">
            <div>الموظفون: {preview.data.totalEmployees}</div>
            <div>جاهز: {preview.data.ready}</div>
            <div>محجوب: {preview.data.blocked}</div>
            <div>المحرك: {preview.data.engineMode}</div>
            <div>تقديرات: {preview.data.amountsRedacted ? 'مخفية' : `${preview.data.totals?.net?.toLocaleString()} صافي`}</div>
          </div>
          {!preview.data.amountsRedacted && preview.data.totals && (
            <div className="grid md:grid-cols-4 gap-2 text-xs">
              <div>إجمالي: {preview.data.totals.gross.toLocaleString()}</div>
              <div>استقطاعات: {preview.data.totals.deductions.toLocaleString()}</div>
              <div>مساهمات ER: {preview.data.totals.employerContributions.toLocaleString()}</div>
              <div>صافي: {preview.data.totals.net.toLocaleString()}</div>
            </div>
          )}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`border rounded px-2 py-0.5 ${blockerFilter === 'ALL' ? 'bg-muted' : ''}`} onClick={() => setBlockerFilter('ALL')}>كل المعوقات</button>
              {categories.map((c) => (
                <button key={c} type="button" className={`border rounded px-2 py-0.5 ${blockerFilter === c ? 'bg-muted' : ''}`} onClick={() => setBlockerFilter(c)}>{c}</button>
              ))}
            </div>
          )}
          {filteredBlockers.length > 0 && (
            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-muted">
                  <th className="p-1 text-right">الموظف</th>
                  <th className="p-1 text-right">الفئة</th>
                  <th className="p-1 text-right">الرسالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredBlockers.map((b) => (
                  <tr key={b.employeeId} className="border-t">
                    <td className="p-1">{b.employeeName ?? b.employeeId} ({b.serial ?? '—'})</td>
                    <td className="p-1">{b.category}</td>
                    <td className="p-1">{b.messages.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {jobId && jobStatus.data && (
        <div className="text-sm border rounded p-3">
          مهمة الاحتساب: {jobStatus.data.state} — {jobStatus.data.progress}%
          {jobStatus.data.failedReason && <div className="text-destructive">{jobStatus.data.failedReason}</div>}
        </div>
      )}

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-right">الفترة</th>
            <th className="p-2 text-right">الحالة</th>
            <th className="p-2 text-right">الموظفون</th>
            <th className="p-2 text-right">الصافي</th>
            <th className="p-2 text-right" />
          </tr>
        </thead>
        <tbody>
          {(list.data?.rows ?? []).map((row) => (
            <tr key={row.id} className="border-t">
              <td className="p-2">{row.periodYear}-{String(row.periodMonth).padStart(2, '0')}</td>
              <td className="p-2">{row.status}</td>
              <td className="p-2">{row.employeeCount}</td>
              <td className="p-2">{row.net?.toLocaleString() ?? '—'}</td>
              <td className="p-2">
                <Link className="underline" href={`/hr/payroll/runs/${row.id}`}>مراجعة</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 text-sm">
        <button type="button" className="border rounded px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</button>
        <span>صفحة {page}</span>
        <button type="button" className="border rounded px-2" onClick={() => setPage((p) => p + 1)}>التالي</button>
      </div>
    </div>
  );
}
