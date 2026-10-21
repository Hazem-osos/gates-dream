'use client';

import Link from 'next/link';

function money(n: number) {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type SummaryReport = {
  totals: { gross: number; net: number; employerContributions: number };
  employeeCount: number;
  reportingEligible?: boolean;
  reportingNotice?: string | null;
  status?: string;
};

type RegisterReport = {
  rows: Array<{ employeeId: string; employeeName: string; serial?: string; grossSalary: number; netSalary: number }>;
  totals?: { gross: number; net: number };
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  filteredTotals?: { gross: number; net: number };
};

type ComponentSummary = {
  components: Array<{ code: string; componentType: string; total: number }>;
};

type DeductionSummary = {
  deductions: Array<{ code: string; total: number }>;
};

type RowReport = {
  rows: Array<Record<string, unknown>>;
};

type DimensionReport = {
  dimension: string;
  rows: Array<{ dimensionId: string; employeeCount: number; gross: number; net: number }>;
};

type ReconciliationReport = {
  payrollTotals?: { gross: number; net: number };
  reconciliation?: {
    grossFromComponents?: number;
    netFromComponents?: number;
    headerGross?: number;
    headerNet?: number;
    balanced?: boolean;
    blockers?: string[];
  };
  journalVsPayroll?: {
    accrualDebitTotal?: number;
    payrollNet?: number;
    difference?: number | null;
    balanced?: boolean;
  };
  reconciliationStatus?: string;
  missingMappings?: string[];
  blockingExceptions?: string[];
  accrualJournalEntryId?: string | null;
  paymentJournalEntryId?: string | null;
  accrualJournal?: { entryNumber?: string | null; totalDebit?: number; totalCredit?: number; found?: boolean };
  paymentJournal?: { entryNumber?: string | null; totalDebit?: number; totalCredit?: number; found?: boolean };
};

export function PayrollReportSummaryView({ data }: { data: SummaryReport }) {
  return (
    <div className="space-y-3">
      {data.reportingNotice ? (
        <p className="text-sm text-amber-800 border border-amber-200 bg-amber-50 rounded p-2">{data.reportingNotice}</p>
      ) : null}
    <div className="grid md:grid-cols-4 gap-3 text-sm">
      <div className="border rounded p-3">الإجمالي: {money(data.totals.gross)}</div>
      <div className="border rounded p-3">الصافي: {money(data.totals.net)}</div>
      <div className="border rounded p-3">مساهمات صاحب العمل: {money(data.totals.employerContributions)}</div>
      <div className="border rounded p-3">عدد الموظفين: {data.employeeCount}</div>
    </div>
    </div>
  );
}

export function PayrollReportRegisterView({
  data,
  runId,
  page,
  onPageChange,
}: {
  data: RegisterReport;
  runId: string;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = data.totalPages ?? (data.total && data.pageSize ? Math.ceil(data.total / data.pageSize) : 1);
  return (
    <>
      <div className="text-sm text-muted-foreground mb-2">
        إجماليات التقرير (مجموعة الفلتر كاملة): إجمالي {money(data.totals?.gross ?? 0)} · صافي{' '}
        {money(data.totals?.net ?? 0)}
        {data.filteredTotals &&
        (data.filteredTotals.gross !== data.totals?.gross || data.filteredTotals.net !== data.totals?.net) ? (
          <span className="block text-xs">(مطابقة للفلتر الحالي)</span>
        ) : null}
        {data.total != null ? <span className="block text-xs">سجلات: {data.total}</span> : null}
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
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">لا توجد سجلات</td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.employeeId} className="border-t">
                  <td className="p-2">{row.serial ?? '—'}</td>
                  <td className="p-2">{row.employeeName}</td>
                  <td className="p-2 tabular-nums">{money(row.grossSalary)}</td>
                  <td className="p-2 tabular-nums">{money(row.netSalary)}</td>
                  <td className="p-2">
                    <Link className="underline" href={`/hr/payroll/runs/${runId}/payslip/${row.employeeId}`}>
                      قسيمة
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 text-sm mt-2 items-center">
        <button type="button" className="border rounded px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          السابق
        </button>
        <span>صفحة {page} من {totalPages}</span>
        <button type="button" className="border rounded px-2 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          التالي
        </button>
      </div>
    </>
  );
}

function SimpleRowsTable({
  columns,
  rows,
  emptyLabel = 'لا توجد بيانات',
}: {
  columns: Array<{ key: string; header: string; format?: (v: unknown) => string }>;
  rows: Array<Record<string, unknown>>;
  emptyLabel?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border min-w-[480px]">
        <thead>
          <tr className="bg-muted">
            {columns.map((c) => (
              <th key={c.key} className="p-2 text-right">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-4 text-center text-muted-foreground">{emptyLabel}</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={c.key} className="p-2 tabular-nums">
                    {c.format ? c.format(row[c.key]) : String(row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type ReportPagination = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
};

function ReportPaginationBar({ pagination }: { pagination: ReportPagination }) {
  return (
    <div className="flex gap-2 text-sm mt-3 items-center">
      <button
        type="button"
        className="border rounded px-2 py-1 disabled:opacity-50"
        disabled={pagination.page <= 1}
        onClick={() => pagination.onPageChange(pagination.page - 1)}
      >
        السابق
      </button>
      <span>
        صفحة {pagination.page} من {pagination.totalPages || 1} ({pagination.total} سجل)
      </span>
      <button
        type="button"
        className="border rounded px-2 py-1 disabled:opacity-50"
        disabled={pagination.page >= (pagination.totalPages || 1)}
        onClick={() => pagination.onPageChange(pagination.page + 1)}
      >
        التالي
      </button>
    </div>
  );
}

export function PayrollReportDetailView({
  reportKey,
  data,
  pagination,
}: {
  reportKey: string;
  data: unknown;
  pagination?: ReportPagination;
}) {
  if (!data) return null;

  const rowReport = data as RowReport & { totals?: { amount?: number }; total?: number; totalPages?: number };
  const totalsBanner =
    rowReport.totals?.amount != null ? (
      <p className="text-sm text-muted-foreground mb-2">
        إجمالي المبلغ (كل الصفحات بعد الفلتر): {money(rowReport.totals.amount)}
      </p>
    ) : null;

  if (reportKey === 'component-summary') {
    const d = data as ComponentSummary;
    return (
      <SimpleRowsTable
        columns={[
          { key: 'code', header: 'المكون' },
          { key: 'componentType', header: 'النوع' },
          { key: 'total', header: 'الإجمالي', format: (v) => money(Number(v)) },
        ]}
        rows={d.components as Array<Record<string, unknown>>}
      />
    );
  }

  if (reportKey === 'deduction-summary') {
    const d = data as DeductionSummary;
    return (
      <SimpleRowsTable
        columns={[
          { key: 'code', header: 'الاستقطاع' },
          { key: 'total', header: 'الإجمالي', format: (v) => money(Number(v)) },
        ]}
        rows={d.deductions as Array<Record<string, unknown>>}
      />
    );
  }

  if (reportKey === 'overtime') {
    const d = data as RowReport;
    return (
      <>
      {totalsBanner}
      <SimpleRowsTable
        columns={[
          { key: 'employeeName', header: 'الموظف' },
          { key: 'quantity', header: 'الكمية' },
          { key: 'amount', header: 'المبلغ', format: (v) => money(Number(v)) },
        ]}
        rows={d.rows}
      />
      {pagination ? <ReportPaginationBar pagination={pagination} /> : null}
      </>
    );
  }

  if (reportKey === 'absence-leave') {
    const d = data as RowReport;
    return (
      <>
      {totalsBanner}
      <SimpleRowsTable
        columns={[
          { key: 'employeeName', header: 'الموظف' },
          { key: 'code', header: 'الكود' },
          { key: 'quantity', header: 'الكمية' },
          { key: 'amount', header: 'المبلغ', format: (v) => money(Number(v)) },
        ]}
        rows={d.rows}
      />
      {pagination ? <ReportPaginationBar pagination={pagination} /> : null}
      </>
    );
  }

  if (reportKey === 'advance-recovery') {
    const d = data as RowReport;
    return (
      <>
      {totalsBanner}
      <SimpleRowsTable
        columns={[
          { key: 'employeeName', header: 'الموظف' },
          { key: 'advanceId', header: 'السلفة' },
          { key: 'amount', header: 'المبلغ', format: (v) => money(Number(v)) },
        ]}
        rows={d.rows}
      />
      {pagination ? <ReportPaginationBar pagination={pagination} /> : null}
      </>
    );
  }

  if (reportKey === 'employer-contributions') {
    const d = data as RowReport;
    return (
      <>
      {totalsBanner}
      <SimpleRowsTable
        columns={[
          { key: 'employeeName', header: 'الموظف' },
          { key: 'code', header: 'المكون' },
          { key: 'amount', header: 'المبلغ', format: (v) => money(Number(v)) },
        ]}
        rows={d.rows}
      />
      {pagination ? <ReportPaginationBar pagination={pagination} /> : null}
      </>
    );
  }

  if (reportKey.startsWith('by-')) {
    const d = data as DimensionReport;
    const dimLabel =
      reportKey === 'by-branch' ? 'الفرع' : reportKey === 'by-department' ? 'القسم' : 'مركز التكلفة';
    return (
      <SimpleRowsTable
        columns={[
          { key: 'dimensionId', header: dimLabel },
          { key: 'employeeCount', header: 'عدد الموظفين' },
          { key: 'gross', header: 'الإجمالي', format: (v) => money(Number(v)) },
          { key: 'net', header: 'الصافي', format: (v) => money(Number(v)) },
        ]}
        rows={d.rows as Array<Record<string, unknown>>}
      />
    );
  }

  if (reportKey === 'reconciliation') {
    const d = data as ReconciliationReport;
    const statusLabel =
      d.reconciliationStatus === 'BALANCED'
        ? 'متزن'
        : d.reconciliationStatus === 'WARN_MAPPINGS'
          ? 'متزن مع تحذيرات ربط'
          : 'يتطلب مراجعة';
    return (
      <div className="text-sm space-y-4 border rounded p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="font-semibold">حالة التسوية:</span>
          <span className="rounded border px-2 py-0.5">{statusLabel}</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="border rounded p-3">
            <div className="text-muted-foreground text-xs">إجمالي المسيرة</div>
            <div className="tabular-nums">{money(d.payrollTotals?.gross ?? 0)}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-muted-foreground text-xs">صافي المسيرة</div>
            <div className="tabular-nums">{money(d.payrollTotals?.net ?? 0)}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-muted-foreground text-xs">الفرق (قيد الاستحقاق − الصافي)</div>
            <div className="tabular-nums">
              {d.journalVsPayroll?.difference != null
                ? money(d.journalVsPayroll.difference)
                : '—'}
            </div>
          </div>
        </div>
        <table className="w-full text-xs border">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-right">البند</th>
              <th className="p-2 text-right">من المكونات</th>
              <th className="p-2 text-right">رأس المسيرة</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-2">الإجمالي</td>
              <td className="p-2 tabular-nums">{money(d.reconciliation?.grossFromComponents ?? 0)}</td>
              <td className="p-2 tabular-nums">{money(d.reconciliation?.headerGross ?? 0)}</td>
            </tr>
            <tr className="border-t">
              <td className="p-2">الصافي</td>
              <td className="p-2 tabular-nums">{money(d.reconciliation?.netFromComponents ?? 0)}</td>
              <td className="p-2 tabular-nums">{money(d.reconciliation?.headerNet ?? 0)}</td>
            </tr>
          </tbody>
        </table>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="border rounded p-3 space-y-1">
            <div className="font-medium">قيد الاستحقاق</div>
            {d.accrualJournalEntryId ? (
              <Link className="underline text-xs" href={`/accounting/operations/journal-entries/${d.accrualJournalEntryId}`}>
                {d.accrualJournal?.entryNumber ?? d.accrualJournalEntryId}
              </Link>
            ) : (
              <span>—</span>
            )}
            <div className="text-muted-foreground">
              مدين: {money(d.accrualJournal?.totalDebit ?? 0)} · دائن:{' '}
              {money(d.accrualJournal?.totalCredit ?? 0)}
            </div>
          </div>
          <div className="border rounded p-3 space-y-1">
            <div className="font-medium">قيد الدفع</div>
            {d.paymentJournalEntryId ? (
              <Link className="underline text-xs" href={`/accounting/operations/journal-entries/${d.paymentJournalEntryId}`}>
                {d.paymentJournal?.entryNumber ?? d.paymentJournalEntryId}
              </Link>
            ) : (
              <span>—</span>
            )}
            <div className="text-muted-foreground">
              مدين: {money(d.paymentJournal?.totalDebit ?? 0)} · دائن:{' '}
              {money(d.paymentJournal?.totalCredit ?? 0)}
            </div>
          </div>
        </div>
        {(d.missingMappings?.length ?? 0) > 0 && (
          <div className="text-destructive text-xs">
            ربط حسابات ناقص: {d.missingMappings?.join(' · ')}
          </div>
        )}
        {(d.blockingExceptions?.length ?? 0) > 0 && (
          <div className="text-destructive text-xs">
            استثناءات: {d.blockingExceptions?.join(' · ')}
          </div>
        )}
      </div>
    );
  }

  return null;
}
