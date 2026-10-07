'use client';

import { useMemo } from 'react';
import { AppTable } from '@/app/components/ui/AppTable';
import { MfgTableCard } from '@/components/manufacturing/ManufacturingPageChrome';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatApiErrorMessage } from '@/lib/api/format-api-error';
import {
  buildContractingReportColumns,
  extractContractingReportRows,
} from '@/lib/contracting/report-table-columns';
import { formatEgp } from '@/lib/subcontracts/money';

function MetricGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'number' || typeof v === 'string');
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-[#D6EAF3] bg-white p-3 text-sm">
          <p className="text-xs text-slate-500">{k}</p>
          <p className="font-bold tabular-nums text-[#0E78AA]">
            {typeof v === 'number' ? formatEgp(v) : String(v)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ContractingReportResults({
  reportKey,
  apiPath,
  queryParams,
}: {
  reportKey: string;
  apiPath: string;
  queryParams: Record<string, string>;
}) {
  const { data: response, isLoading, isError, error } = useApiQuery<unknown>(
    ['contracting-report', reportKey, apiPath, queryParams],
    apiPath,
    queryParams
  );

  const payload = response?.data;
  const rows = useMemo(() => extractContractingReportRows(payload), [payload]);
  const columns = useMemo(() => buildContractingReportColumns(rows), [rows]);

  const portfolio =
    reportKey === 'management-dashboard' &&
    payload &&
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).portfolio === 'object'
      ? ((payload as Record<string, unknown>).portfolio as Record<string, unknown>)
      : null;

  if (isError) {
    return (
      <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {formatApiErrorMessage(error as unknown as Error & { message?: string })}
      </p>
    );
  }

  if (isLoading) {
    return <p className="mt-4 text-sm text-slate-600">جاري تحميل التقرير…</p>;
  }

  if (portfolio) {
    return (
      <div className="mt-4">
        <MetricGrid data={portfolio} />
      </div>
    );
  }

  if (reportKey === 'project-financial-position' && payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    return (
      <div className="mt-4 space-y-4">
        {['contract', 'revenue', 'cost', 'execution'].map((section) =>
          data[section] && typeof data[section] === 'object' ? (
            <div key={section}>
              <h3 className="mb-2 text-sm font-bold text-[#0A3D5E]">{section}</h3>
              <MetricGrid data={data[section] as Record<string, unknown>} />
            </div>
          ) : null
        )}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <p className="mt-4 rounded-lg border border-[#D6EAF3] bg-[#F8FBFD] px-4 py-6 text-center text-sm text-slate-600">
        لا توجد بيانات للمعايير المحددة.
      </p>
    );
  }

  const numericKeys = columns.filter((c) => c.numeric).map((c) => c.id);
  const totals = numericKeys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = rows.reduce((s, row) => s + (Number(row[key]) || 0), 0);
    return acc;
  }, {});

  return (
    <MfgTableCard title="نتيجة التقرير">
      <AppTable
        columns={columns}
        data={rows}
        getRowKey={(row, i) => String(row.id ?? row.certificateNumber ?? i)}
        exportFileName={`contracting-${reportKey}`}
        stickyHeader
      />
      {numericKeys.length > 0 ? (
        <div className="flex flex-wrap gap-4 border-t border-[#D6EAF3] bg-[#E8F4FA] px-4 py-3 text-sm">
          <span className="font-bold text-[#0A3D5E]">الإجماليات:</span>
          {numericKeys.slice(0, 5).map((key) => (
            <span key={key} className="tabular-nums">
              {columns.find((c) => c.id === key)?.header}: {formatEgp(totals[key] ?? 0)}
            </span>
          ))}
        </div>
      ) : null}
    </MfgTableCard>
  );
}
