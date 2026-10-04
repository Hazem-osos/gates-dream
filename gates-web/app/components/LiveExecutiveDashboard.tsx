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
import { useI18n } from '@/lib/i18n';
import { GatesDataNetwork } from '@/components/visual/GatesDataNetwork';

export default function LiveExecutiveDashboard({ title }: { title?: string }) {
  const { t } = useI18n();
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
      title={title ?? t('dashboard.title')}
      module={t('dashboard.module')}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: t('dashboard.salesInvoice'), href: '/inventory/operations/sales-invoice' },
        { key: 'F8', label: t('dashboard.executive'), href: '/executive' },
        { key: 'F9', label: t('dashboard.diagnostic'), href: '/diagnostic' },
      ]}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <SentinelRiskButton />
        </div>
      }
    >
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-surface-1 px-5 py-4">
        <GatesDataNetwork className="absolute inset-0 h-full w-full" opacity={0.35} />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{t('common.connected')}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">{t('common.osTagline')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-foreground-muted">{t('dashboard.subtitle')}</p>
        </div>
      </div>
      <WelcomeTourCard />
      <LaunchChecklistWidget />
      <GatesSentinelRadarWidget />

      {isError ? (
        <p className="mb-2 border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
          {t('dashboard.loadError')}
          {error?.message
            ? ` ${localizeApiErrorMessage(error.message, Number.parseInt(error.code ?? '', 10) || undefined)}`
            : ''}
        </p>
      ) : null}

      <MetricBar
        loading={(isLoading || !companyReady) && !kpis}
        items={[
          { id: 's', label: t('dashboard.monthlySales'), value: formatMoney(kpis?.periodTotals.monthlySales ?? 0), spark: trend.map((row) => row.sales) },
          { id: 'p', label: t('dashboard.monthlyPurchases'), value: formatMoney(kpis?.periodTotals.monthlyPurchases ?? 0), spark: trend.map((row) => row.purchases) },
          { id: 'liq', label: t('dashboard.liquidity'), value: formatMoney(kpis?.cashAndBankLiquidity ?? 0) },
          {
            id: 'pl',
            label: t('dashboard.netPeriod'),
            value: formatMoney(kpis?.periodTotals.netProfitLoss ?? 0),
            tone: (kpis?.periodTotals.netProfitLoss ?? 0) >= 0 ? 'ok' : 'bad',
          },
          { id: 'ar', label: t('dashboard.receivables'), value: formatMoney(arRes?.data?.summary.totalOutstanding ?? 0), hint: t('dashboard.partyCount', { count: arRes?.data?.summary.partyCount ?? 0 }) },
          { id: 'ap', label: t('dashboard.payables'), value: formatMoney(apRes?.data?.summary.totalOutstanding ?? 0), hint: t('dashboard.partyCount', { count: apRes?.data?.summary.partyCount ?? 0 }) },
        ]}
      />

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">{t('dashboard.pendingApprovals')}</p>
          <SegmentedBar
            segments={[
              { label: t('dashboard.invoices'), value: kpis?.pendingDocuments.unpostedInvoices ?? 0, color: '#D97706' },
              { label: t('dashboard.journals'), value: kpis?.pendingDocuments.unpostedJournalEntries ?? 0, color: '#0E78AA' },
              { label: t('dashboard.treasury'), value: kpis?.pendingDocuments.unpostedTreasuryTransactions ?? 0, color: '#1499D6' },
            ]}
          />
        </div>
        <TriageQueue
          title={t('dashboard.managerQueue')}
          items={[
            {
              id: 'inv',
              title: t('dashboard.unpostedInvoices'),
              amount: String(kpis?.pendingDocuments.unpostedInvoices ?? 0),
              href: '/inventory/operations/sales-invoice',
              tone: (kpis?.pendingDocuments.unpostedInvoices ?? 0) > 0 ? 'warn' : 'info',
            },
            {
              id: 'je',
              title: t('dashboard.unpostedJournals'),
              amount: String(kpis?.pendingDocuments.unpostedJournalEntries ?? 0),
              href: '/accounting/operations/journal-entry',
              tone: 'warn',
            },
            {
              id: 'tr',
              title: t('dashboard.pendingTreasury'),
              amount: String(kpis?.pendingDocuments.unpostedTreasuryTransactions ?? 0),
              href: '/accounting/operations/treasury',
              tone: 'info',
            },
          ]}
        />
        <DataGridDense
          title={t('dashboard.topCustomers')}
          rows={(kpis?.topCustomers ?? []).map((c) => ({ id: c.customerId, ...c }))}
          columns={[
            { id: 'n', header: t('dashboard.customer'), cell: (r) => r.customerName },
            { id: 'v', header: t('dashboard.revenue'), numeric: true, cell: (r) => formatMoney(r.revenue) },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
