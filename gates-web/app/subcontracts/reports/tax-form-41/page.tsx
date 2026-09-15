'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { SubcontractCard } from '@/components/subcontracts/SubcontractPageShell';
import { ReportPageShell } from '@/components/erp/ReportPageHeader';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { downloadTaxForm41 } from '@/lib/subcontracts/download-form-41';
import { formatEgp, toMoney } from '@/lib/subcontracts/money';
import type { Form41Preview } from '@/lib/subcontracts/types';
import { toast } from '@/lib/feedback/toast';

const QUARTERS = [
  { value: 1, label: 'الربع الأول' },
  { value: 2, label: 'الربع الثاني' },
  { value: 3, label: 'الربع الثالث' },
  { value: 4, label: 'الربع الرابع' },
] as const;

export default function TaxForm41ReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>((Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4);
  const [exporting, setExporting] = useState<'CSV' | 'EXCEL' | null>(null);

  const { data, isLoading, isError } = useApiQuery<Form41Preview>(
    queryKeys.subcontracts.form41(year, quarter),
    '/subcontracts/reports/tax-form-41/preview',
    { year, quarter },
    { staleTime: staleTimes.transactionalMs }
  );
  const preview = data?.data;
  const rows = useMemo(() => preview?.rows ?? [], [preview?.rows]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          gross: acc.gross + toMoney(row.gross),
          withheld: acc.withheld + toMoney(row.withheld),
          net: acc.net + toMoney(row.net),
        }),
        { gross: 0, withheld: 0, net: 0 }
      ),
    [rows]
  );

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const onExport = async (format: 'CSV' | 'EXCEL') => {
    setExporting(format);
    try {
      await downloadTaxForm41(year, quarter, format);
      toast.success(format === 'EXCEL' ? 'تم تنزيل ملف Excel' : 'تم تنزيل ملف CSV');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر التصدير');
    } finally {
      setExporting(null);
    }
  };

  return (
    <ReportPageShell
      title="نموذج 41 — خصم ضريبة الأرباح التجارية"
      breadcrumbs={breadcrumbsForReportModule('subcontracts', 'نموذج 41')}
      extraActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            iconStart={<Download className="h-4 w-4" />}
            isLoading={exporting === 'CSV'}
            onClick={() => void onExport('CSV')}
          >
            تصدير CSV
          </Button>
          <Button
            iconStart={<Download className="h-4 w-4" />}
            isLoading={exporting === 'EXCEL'}
            onClick={() => void onExport('EXCEL')}
          >
            تصدير Excel
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate-600 text-right">
        تجميع ربع سنوي للمستخلصات المرحلة وفق صيغة مصلحة الضرائب المصرية.
      </p>
      <SubcontractCard>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">السنة</span>
            <select
              className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">الربع</span>
            <select
              className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            >
              {QUARTERS.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label} {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <TableSkeleton columns={5} rows={6} />
        ) : isError ? (
          <EmptyState title="تعذر تحميل المعاينة" />
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد مستخلصات مرحلة في هذا الربع" description="يظهر هنا فقط المستخلصات بحالة مرحل حسابات." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
            <table className="w-full min-w-[860px] text-center text-sm">
              <thead>
                <tr className="bg-[#0E78AA] text-white">
                  <th className="px-3 py-3">الرقم الضريبي</th>
                  <th className="px-3 py-3">المقاول</th>
                  <th className="px-3 py-3">إجمالي الأعمال</th>
                  <th className="px-3 py-3">خصم 1٪</th>
                  <th className="px-3 py-3">الصافي</th>
                  <th className="px-3 py-3">المرجع</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.taxId}-${row.invoiceRef}-${index}`} className={index % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                    <td className="px-3 py-3 tabular-nums" dir="ltr">
                      {row.taxId}
                    </td>
                    <td className="px-3 py-3">{row.name}</td>
                    <td className="px-3 py-3 tabular-nums">{formatEgp(row.gross)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatEgp(row.withheld)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatEgp(row.net)}</td>
                    <td className="px-3 py-3 text-xs">{row.invoiceRef}</td>
                  </tr>
                ))}
                <tr className="bg-[#F0F7FB] font-bold">
                  <td className="px-3 py-3" colSpan={2}>
                    الإجمالي
                  </td>
                  <td className="px-3 py-3 tabular-nums">{formatEgp(totals.gross)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatEgp(totals.withheld)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatEgp(totals.net)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SubcontractCard>
    </ReportPageShell>
  );
}
