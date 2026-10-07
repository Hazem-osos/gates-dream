'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { PartySelect } from '@/app/components/form/PartySelect';
import { ContractingReportChrome } from '@/components/contracting/ContractingReportChrome';
import { ContractingReportResults } from '@/components/contracting/ContractingReportResults';
import {
  ReportFilterDate,
  ReportFilterField,
  ReportFilterPageShell,
  ReportFilterSection,
  ReportFilterSelect,
} from '@/components/report/reportFilterFields';
import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';
import { CONTRACTING_REPORT_CONFIG } from '@/lib/contracting/reports-config';
import { useApiQuery } from '@/lib/hooks/useApi';

type ProjectRow = { id: string; projectCode: string; projectName: string };
type SubcontractorRow = { id: string; arabicName: string; code?: string | null };

function buildApiPath(
  config: (typeof CONTRACTING_REPORT_CONFIG)[string],
  ids: { projectId: string; customerId: string; subcontractorId: string }
): string {
  if (typeof config.apiPath === 'function') {
    return config.apiPath(ids);
  }
  return config.apiPath;
}

function buildQueryParams(
  config: (typeof CONTRACTING_REPORT_CONFIG)[string],
  filters: {
    projectId: string;
    customerId: string;
    subcontractorId: string;
    dateFrom: string;
    dateTo: string;
  }
): Record<string, string> {
  const q: Record<string, string> = {};
  if (filters.dateFrom) q.dateFrom = filters.dateFrom;
  if (filters.dateTo) q.dateTo = filters.dateTo;

  const projectInPath = typeof config.apiPath === 'function' && config.needsProject;
  const customerInPath = typeof config.apiPath === 'function' && config.needsCustomer;
  const subcontractorInPath = typeof config.apiPath === 'function' && config.needsSubcontractor;

  if (filters.projectId && !projectInPath) q.projectId = filters.projectId;
  if (filters.customerId && !customerInPath) q.customerId = filters.customerId;
  if (filters.subcontractorId && !subcontractorInPath) q.subcontractorId = filters.subcontractorId;

  return q;
}

const defaultFilters = () => ({
  ...reportDefaultDateRange(),
  projectId: '',
  customerId: '',
  subcontractorId: '',
});

export default function ContractingReportPage() {
  const params = useParams<{ reportKey: string }>();
  const key = params.reportKey;
  const config = CONTRACTING_REPORT_CONFIG[key];

  const [filters, setFilters] = useState(defaultFilters);
  const [preview, setPreview] = useState<{
    apiPath: string;
    queryParams: Record<string, string>;
  } | null>(null);
  const [error, setError] = useState('');

  const patch = (p: Partial<ReturnType<typeof defaultFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const projectsQ = useApiQuery<ProjectRow[]>(
    ['contracting-projects-report-filter'],
    '/contracting/projects',
    { limit: 300 },
    { staleTime: 60_000 }
  );
  const projects = projectsQ.data?.data ?? [];

  const subcontractorsQ = useApiQuery<SubcontractorRow[]>(
    ['contracting-report-subcontractors'],
    '/subcontracts/directory/subcontractors',
    { limit: 300 },
    { enabled: Boolean(config?.needsSubcontractor) }
  );
  const subcontractors = subcontractorsQ.data?.data ?? [];

  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: `${p.projectCode} — ${p.projectName}` })),
    [projects]
  );

  const subcontractorOptions = useMemo(
    () =>
      subcontractors.map((s) => ({
        value: s.id,
        label: s.code ? `[${s.code}] ${s.arabicName}` : s.arabicName,
      })),
    [subcontractors]
  );

  const showProjectFilter =
    config &&
    ((config.needsProject || !config.needsCustomer) && !config.needsSubcontractor);

  const handlePreview = () => {
    if (!config) return;
    setError('');
    if (config.needsProject && !filters.projectId) {
      setError('اختر المشروع');
      return;
    }
    if (config.needsCustomer && !filters.customerId) {
      setError('اختر العميل');
      return;
    }
    if (config.needsSubcontractor && !filters.subcontractorId) {
      setError('اختر مقاول الباطن');
      return;
    }
    if (config.dateRange && (!filters.fromDate || !filters.toDate)) {
      setError('حدد من تاريخ وإلى تاريخ');
      return;
    }

    const apiPath = buildApiPath(config, {
      projectId: filters.projectId,
      customerId: filters.customerId,
      subcontractorId: filters.subcontractorId,
    });
    const queryParams = buildQueryParams(config, {
      projectId: filters.projectId,
      customerId: filters.customerId,
      subcontractorId: filters.subcontractorId,
      dateFrom: filters.fromDate,
      dateTo: filters.toDate,
    });

    setPreview({ apiPath, queryParams });
  };

  if (!config) {
    return (
      <ReportFilterPageShell title="تقرير غير معروف">
        <Link href="/contracting/reports" className="text-[#0E78AA] underline">
          العودة لمركز التقارير
        </Link>
      </ReportFilterPageShell>
    );
  }

  return (
    <ContractingReportChrome
      title={config.titleAr}
      onPreview={handlePreview}
      onReset={() => {
        setFilters(defaultFilters());
        setPreview(null);
        setError('');
      }}
      error={error}
      onClearError={() => setError('')}
      below={
        preview ? (
          <ContractingReportResults
            reportKey={key}
            apiPath={preview.apiPath}
            queryParams={preview.queryParams}
          />
        ) : null
      }
    >
      <ReportFilterSection title="تصفية">
        {showProjectFilter ? (
          <ReportFilterSelect
            label="المشروع"
            value={filters.projectId}
            onChange={(projectId) => patch({ projectId })}
            options={projectOptions}
            placeholder="كل المشروعات"
          />
        ) : null}
        {config.needsCustomer ? (
          <ReportFilterField label="العميل">
            <PartySelect kind="CUSTOMER" value={filters.customerId} onChange={(customerId) => patch({ customerId })} />
          </ReportFilterField>
        ) : null}
        {config.needsSubcontractor ? (
          <ReportFilterSelect
            label="مقاول الباطن"
            value={filters.subcontractorId}
            onChange={(subcontractorId) => patch({ subcontractorId })}
            options={subcontractorOptions}
            placeholder="اختر المقاول"
          />
        ) : null}
        {config.dateRange ? (
          <>
            <ReportFilterDate
              label="من تاريخ"
              value={filters.fromDate}
              onChange={(fromDate) => patch({ fromDate })}
            />
            <ReportFilterDate
              label="إلى تاريخ"
              value={filters.toDate}
              onChange={(toDate) => patch({ toDate })}
            />
          </>
        ) : null}
      </ReportFilterSection>
    </ContractingReportChrome>
  );
}
