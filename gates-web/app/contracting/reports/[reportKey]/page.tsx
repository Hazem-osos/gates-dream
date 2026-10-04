'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ReportFilterPageShell, ReportFilterSection, ReportFilterField } from '@/components/report/reportFilterFields';
import { useApiQuery } from '@/lib/hooks/useApi';
import { CONTRACTING_REPORT_CONFIG } from '@/lib/contracting/reports-config';
import { formatEgp } from '@/lib/subcontracts/money';

type ProjectRow = { id: string; projectCode: string; projectName: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function MetricGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'number' || typeof v === 'string');
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl border bg-[var(--info-soft)] p-3 text-sm">
          <p className="text-xs text-muted-foreground">{k}</p>
          <p className="font-bold tabular-nums text-brand">
            {typeof v === 'number' ? formatEgp(v) : String(v)}
          </p>
        </div>
      ))}
    </div>
  );
}

function JsonTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">لا توجد بيانات للمعايير المحددة.</p>;
  }
  const cols = Object.keys(rows[0]).slice(0, 12);
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="min-w-full text-xs">
        <thead className="bg-[var(--info-soft)]">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-2 py-2 text-right font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 500).map((row, i) => (
            <tr key={i} className="border-t">
              {cols.map((c) => (
                <td key={c} className="px-2 py-1.5 tabular-nums">
                  {formatCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') return formatEgp(v);
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v);
}

function extractRows(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.items)) return d.items as Record<string, unknown>[];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  return [];
}

export default function ContractingReportPage() {
  const params = useParams<{ reportKey: string }>();
  const key = params.reportKey;
  const config = CONTRACTING_REPORT_CONFIG[key];

  const [projectId, setProjectId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const queryParams = useMemo(() => {
    const q: Record<string, string> = {};
    if (projectId) q.projectId = projectId;
    if (customerId) q.customerId = customerId;
    if (subcontractorId) q.subcontractorId = subcontractorId;
    if (dateFrom) q.dateFrom = dateFrom;
    if (dateTo) q.dateTo = dateTo;
    return q;
  }, [projectId, customerId, subcontractorId, dateFrom, dateTo]);

  const apiPath = useMemo(() => {
    if (!config) return '';
    const base =
      typeof config.apiPath === 'function'
        ? config.apiPath({ projectId, customerId, subcontractorId })
        : config.apiPath;
    const qs = new URLSearchParams(queryParams).toString();
    return qs ? `${base}?${qs}` : base;
  }, [config, projectId, customerId, subcontractorId, queryParams]);

  const enabled =
    Boolean(config) &&
    (!config?.needsProject || Boolean(projectId)) &&
    (!config?.needsCustomer || Boolean(customerId)) &&
    (!config?.needsSubcontractor || Boolean(subcontractorId));

  const projectsQ = useApiQuery<ProjectRow[]>(
    ['contracting-projects-report-filter'],
    '/contracting/projects',
    { limit: 300 },
    { staleTime: 60_000 }
  );
  const projects = projectsQ.data?.data ?? [];

  const q = useApiQuery<unknown>(
    ['contracting-report', key, apiPath],
    apiPath,
    queryParams,
    { enabled: enabled && Boolean(apiPath) }
  );

  if (!config) {
    return (
      <ReportFilterPageShell title="تقرير غير معروف">
        <Link href="/contracting/reports" className="text-brand underline">
          العودة لمركز التقارير
        </Link>
      </ReportFilterPageShell>
    );
  }

  const data = q.data?.data;
  const rows = extractRows(data);
  const portfolio =
    key === 'management-dashboard' && isPlainObject(data) && isPlainObject(data.portfolio)
      ? (data.portfolio as Record<string, unknown>)
      : null;

  return (
    <ReportFilterPageShell
      title={config.titleAr}
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { href: '/contracting/reports', label: 'التقارير' },
        { label: config.titleAr },
      ]}
      headerActions={
        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm font-bold"
          onClick={() => window.print()}
        >
          طباعة
        </button>
      }
    >
      <ReportFilterSection title="تصفية">
        {(config.needsProject || !config.needsCustomer) && !config.needsSubcontractor ? (
          <ReportFilterField label="المشروع">
            <select
              className="w-full rounded-lg border px-2 py-1.5 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— الكل / اختر —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} — {p.projectName}
                </option>
              ))}
            </select>
          </ReportFilterField>
        ) : null}
        {config.needsCustomer ? (
          <ReportFilterField label="معرّف العميل (UUID)">
            <input
              className="w-full rounded-lg border px-2 py-1.5 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="customerId"
            />
          </ReportFilterField>
        ) : null}
        {config.needsSubcontractor ? (
          <ReportFilterField label="معرّف المقاول (UUID)">
            <input
              className="w-full rounded-lg border px-2 py-1.5 text-sm"
              value={subcontractorId}
              onChange={(e) => setSubcontractorId(e.target.value)}
            />
          </ReportFilterField>
        ) : null}
        {config.dateRange ? (
          <>
            <ReportFilterField label="من تاريخ">
              <input
                type="date"
                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </ReportFilterField>
            <ReportFilterField label="إلى تاريخ">
              <input
                type="date"
                className="w-full rounded-lg border px-2 py-1.5 text-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </ReportFilterField>
          </>
        ) : null}
      </ReportFilterSection>

      {config.needsProject && !projectId ? (
        <p className="mt-4 text-sm text-muted-foreground">اختر مشروعاً لعرض التقرير.</p>
      ) : null}
      {q.isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> : null}
      {q.isError ? <p className="text-sm text-destructive">تعذر تحميل التقرير.</p> : null}

      {portfolio ? <div className="mt-4 space-y-4"><MetricGrid data={portfolio} /></div> : null}

      {key === 'project-financial-position' && isPlainObject(data) ? (
        <div className="mt-4 space-y-4 text-sm">
          {['contract', 'revenue', 'cost', 'execution'].map((section) =>
            isPlainObject((data as Record<string, unknown>)[section]) ? (
              <div key={section}>
                <h3 className="mb-2 font-bold text-brand">{section}</h3>
                <MetricGrid data={(data as Record<string, Record<string, unknown>>)[section]} />
              </div>
            ) : null
          )}
        </div>
      ) : null}

      {rows.length > 0 && key !== 'project-financial-position' ? (
        <div className="mt-4">
          <JsonTable rows={rows} />
        </div>
      ) : null}

      {!rows.length && !portfolio && enabled && !q.isLoading && key !== 'project-financial-position' ? (
        <p className="mt-4 text-sm text-muted-foreground">لا توجد صفوف — جرّب توسيع التصفية.</p>
      ) : null}

      {isPlainObject(data) && (data as { disclaimerAr?: string }).disclaimerAr ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
          {(data as { disclaimerAr: string }).disclaimerAr}
        </p>
      ) : null}
    </ReportFilterPageShell>
  );
}
