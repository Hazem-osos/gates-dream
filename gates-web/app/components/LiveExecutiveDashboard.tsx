'use client';

import { useMemo } from 'react';
import { GatesSentinelRadarWidget } from '@/components/onboarding/GatesSentinelRadarWidget';
import { LaunchChecklistWidget } from '@/components/onboarding/LaunchChecklistWidget';
import { WelcomeTourCard } from '@/components/onboarding/WelcomeTourCard';
import {
  formatMoney,
  trendMonths,
  useAgingSummary,
  useExecutiveKpis,
} from '@/lib/hooks/useExecutiveDashboard';
import { useCompanyContextReady } from '@/lib/hooks/useTenantContextReady';
import { localizeApiErrorMessage } from '@/lib/api/api-error-notify';
import { SentinelRiskButton } from '@/components/ai/SentinelRiskButton';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  DASH_PANEL,
} from '@/components/dashboard-primitives';

export default function LiveExecutiveDashboard({ title }: { title?: string }) {
  const companyReady = useCompanyContextReady();
  const { data: kpiRes, isLoading, isFetching, isError, error, refetch } = useExecutiveKpis(6);
  const { data: arRes } = useAgingSummary('CUSTOMER');
  const { data: apRes } = useAgingSummary('SUPPLIER');
  const kpis = kpiRes?.data;
  const trend = useMemo(
    () => (kpis ? trendMonths(kpis.monthlyTrend.salesByMonth, kpis.monthlyTrend.purchaseByMonth) : []),
    [kpis]
  );

  return (
    <CommandCenter
      title={title ?? 'مركز قيادة التشغيل'}
      module="GM / OPS"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'فاتورة بيع', href: '/inventory/operations/sales-invoice' },
        { key: 'F8', label: 'الإدارة العليا', href: '/executive' },
        { key: 'F9', label: 'المشخّص', href: '/diagnostic' },
      ]}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <SentinelRiskButton />
        </div>
      }
    >
      <WelcomeTourCard />
      <LaunchChecklistWidget />
      <GatesSentinelRadarWidget />

      {isError ? (
        <p className="mb-2 border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
          تعذّر تحميل التحليلات.
          {error?.message
            ? ` ${localizeApiErrorMessage(error.message, Number.parseInt(error.code ?? '', 10) || undefined)}`
            : ''}
        </p>
      ) : null}

      <MetricBar
        loading={(isLoading || !companyReady) && !kpis}
        items={[
          { id: 's', label: 'مبيعات الشهر', value: formatMoney(kpis?.periodTotals.monthlySales ?? 0), spark: trend.map((t) => t.sales) },
          { id: 'p', label: 'مشتريات الشهر', value: formatMoney(kpis?.periodTotals.monthlyPurchases ?? 0), spark: trend.map((t) => t.purchases) },
          { id: 'liq', label: 'سيولة خزن+بنك', value: formatMoney(kpis?.cashAndBankLiquidity ?? 0) },
          {
            id: 'pl',
            label: 'صافي الفترة',
            value: formatMoney(kpis?.periodTotals.netProfitLoss ?? 0),
            tone: (kpis?.periodTotals.netProfitLoss ?? 0) >= 0 ? 'ok' : 'bad',
          },
          { id: 'ar', label: 'مدينون', value: formatMoney(arRes?.data?.summary.totalOutstanding ?? 0), hint: `${arRes?.data?.summary.partyCount ?? 0} طرف` },
          { id: 'ap', label: 'دائنون', value: formatMoney(apRes?.data?.summary.totalOutstanding ?? 0), hint: `${apRes?.data?.summary.partyCount ?? 0} طرف` },
        ]}
      />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">اعتمادات معلّقة</p>
          <SegmentedBar
            segments={[
              { label: 'فواتير', value: kpis?.pendingDocuments.unpostedInvoices ?? 0, color: '#D97706' },
              { label: 'قيود', value: kpis?.pendingDocuments.unpostedJournalEntries ?? 0, color: '#0E79AA' },
              { label: 'خزينة', value: kpis?.pendingDocuments.unpostedTreasuryTransactions ?? 0, color: '#7C3AED' },
            ]}
          />
        </div>
        <TriageQueue
          title="طابور المدير"
          items={[
            {
              id: 'inv',
              title: 'فواتير غير مرحلة',
              amount: String(kpis?.pendingDocuments.unpostedInvoices ?? 0),
              href: '/inventory/operations/sales-invoice',
              tone: (kpis?.pendingDocuments.unpostedInvoices ?? 0) > 0 ? 'warn' : 'info',
            },
            {
              id: 'je',
              title: 'قيود غير مرحلة',
              amount: String(kpis?.pendingDocuments.unpostedJournalEntries ?? 0),
              href: '/accounting/operations/journal-entry',
              tone: 'warn',
            },
            {
              id: 'tr',
              title: 'حركات خزينة معلّقة',
              amount: String(kpis?.pendingDocuments.unpostedTreasuryTransactions ?? 0),
              href: '/accounting/operations/treasury/cash-receipt',
              tone: 'info',
            },
          ]}
        />
        <DataGridDense
          title="أعلى عملاء الفترة"
          rows={(kpis?.topCustomers ?? []).map((c) => ({ id: c.customerId, ...c }))}
          columns={[
            { id: 'n', header: 'العميل', cell: (r) => r.customerName },
            { id: 'v', header: 'إيراد', numeric: true, cell: (r) => formatMoney(r.revenue) },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
