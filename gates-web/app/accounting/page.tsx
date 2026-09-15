'use client';

import { useMemo, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatMoney, useAgingSummary, useExecutiveKpis, useExecutiveOverview } from '@/lib/hooks/useExecutiveDashboard';
import { periodBounds, toFiniteNumber, inPeriod, type DashboardPeriod, PeriodSegmentedControl } from '@/components/dashboard';
import { SentinelRiskButton } from '@/components/ai/SentinelRiskButton';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  StatusDotPill,
  DASH_PANEL,
  DASH_NUM,
  DASH_GRID,
} from '@/components/dashboard-primitives';

type JournalRow = {
  id: string;
  date: string;
  description?: string | null;
  voucherNumber?: string | null;
  isPosted: boolean;
  isApproved?: boolean;
  totalDebit?: number | string;
};

export default function TreasuryCommand() {
  useBackendReachability();
  const invalidate = useInvalidateQuery();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const bounds = periodBounds(period);
  const kpisQ = useExecutiveKpis(6);
  const overviewQ = useExecutiveOverview();
  const arQ = useAgingSummary('CUSTOMER');
  const journalsQ = useApiQuery<JournalRow[]>(
    queryKeys.journalEntries(1, { hub: true, ...bounds }),
    '/accounting/journal-entries',
    { page: 1, limit: 30, includeLines: false, startDate: bounds.startDate, endDate: bounds.endDate },
    { staleTime: staleTimes.transactionalMs }
  );

  const o = overviewQ.data?.data;
  const kpis = kpisQ.data?.data;
  const journals = (journalsQ.data?.data ?? []).filter((j) => inPeriod(j.date, bounds.startDate, bounds.endDate));
  const spark = o?.liquidity.sparkline ?? [];

  const horizon = useMemo(() => {
    const inflow = o?.chequesPipeline.inwardDueThisWeek.amount ?? 0;
    const outflow = (o?.chequesPipeline.outwardDueNext7Days.amount ?? 0) + (o?.shortTermCommitments.supplierApDue14Days ?? 0);
    return { inflow, outflow, net: (o?.liquidity.netAvailable ?? 0) + inflow - outflow };
  }, [o]);

  return (
    <CommandCenter
      title="الخزينة والشيكات — أفق السيولة"
      module="TREASURY"
      asOf={o?.asOf}
      refreshing={kpisQ.isFetching}
      onRefresh={() => {
        void kpisQ.refetch();
        void overviewQ.refetch();
        invalidate(queryKeys.journalEntries(1, { hub: true, ...bounds }));
      }}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <SentinelRiskButton />
          <PeriodSegmentedControl value={period} onChange={setPeriod} />
        </div>
      }
      shortcuts={[
        { key: 'F2', label: 'قيد', href: '/accounting/operations/journal-entry' },
        { key: 'F4', label: 'قبض', href: '/accounting/operations/treasury/receipt-voucher' },
        { key: 'F6', label: 'صرف', href: '/accounting/operations/treasury/payment-voucher' },
      ]}
    >
      <MetricBar
        loading={overviewQ.isLoading && !o}
        items={[
          { id: 'liq', label: 'سيولة نقدية', value: formatMoney(o?.liquidity.netAvailable ?? kpis?.cashAndBankLiquidity ?? 0), hint: `خزن ${formatMoney(o?.liquidity.safes ?? 0)} · بنك ${formatMoney(o?.liquidity.banks ?? 0)}`, spark },
          { id: 'in', label: 'شيكات قبض الأسبوع', value: formatMoney(o?.chequesPipeline.inwardDueThisWeek.amount ?? 0), hint: `${o?.chequesPipeline.inwardDueThisWeek.count ?? 0} ورقة` },
          { id: 'out', label: 'شيكات دفع 7ي', value: formatMoney(o?.chequesPipeline.outwardDueNext7Days.amount ?? 0), hint: `${o?.chequesPipeline.outwardDueNext7Days.count ?? 0} ورقة`, tone: 'warn' },
          { id: 'hz', label: 'أفق 14 يوم', value: formatMoney(horizon.net), tone: horizon.net < 0 ? 'bad' : 'ok' },
          { id: 'je', label: 'قيود غير مرحلة', value: kpis?.pendingDocuments.unpostedJournalEntries ?? journals.filter((j) => !j.isPosted).length, tone: 'warn' },
          { id: 'tr', label: 'خزينة غير مرحلة', value: kpis?.pendingDocuments.unpostedTreasuryTransactions ?? 0 },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">مصفوفة الخزن / البنك</p>
          <SegmentedBar
            segments={[
              { label: 'خزن', value: o?.liquidity.safes ?? 0, color: '#0E79AA' },
              { label: 'بنوك', value: o?.liquidity.banks ?? 0, color: '#059669' },
            ]}
          />
          <p className="mt-3 text-[10px] text-slate-500">
            التزامات قصيرة: موردين {formatMoney(o?.shortTermCommitments.supplierApDue14Days ?? 0)} · شيكات صادرة{' '}
            {formatMoney(o?.shortTermCommitments.outwardChequesDue14Days ?? 0)}
          </p>
        </div>
        <TriageQueue
          title="شيكات تحت التحصيل / استحقاق"
          items={[
            {
              id: 'inw',
              title: 'أوراق قبض تستحق هذا الأسبوع',
              meta: `${o?.chequesPipeline.inwardDueThisWeek.count ?? 0} ورقة`,
              amount: formatMoney(o?.chequesPipeline.inwardDueThisWeek.amount ?? 0),
              href: '/accounting/operations/securities/reciept',
              tone: 'info',
              actions: [{ label: 'إيداع', href: '/accounting/operations/securities/reciept' }],
            },
            {
              id: 'outw',
              title: 'أوراق دفع خلال 7 أيام',
              meta: `${o?.chequesPipeline.outwardDueNext7Days.count ?? 0} ورقة`,
              amount: formatMoney(o?.chequesPipeline.outwardDueNext7Days.amount ?? 0),
              href: '/accounting/operations/securities/payment',
              tone: 'warn',
              actions: [{ label: 'صرف', href: '/accounting/operations/securities/payment' }],
            },
            {
              id: 'ar',
              title: 'ذمم تحتاج متابعة',
              meta: `${arQ.data?.data?.summary.partyCount ?? 0} طرف`,
              amount: formatMoney(arQ.data?.data?.summary.totalOutstanding ?? 0),
              href: '/accounting/account-reports/credit/account-balances',
              tone: 'bad',
            },
          ]}
        />
        <DataGridDense
          title="قيود الفترة"
          loading={journalsQ.isLoading}
          rows={journals.slice(0, 12)}
          emptyActionHref="/accounting/operations/journal-entry"
          emptyActionLabel="إنشاء قيد"
          onRowOpen={() => {
            window.location.href = '/accounting/operations/journal-entry';
          }}
          columns={[
            { id: 'no', header: 'القيد', cell: (r) => <span className={DASH_NUM}>{r.voucherNumber ?? r.id.slice(0, 8)}</span> },
            { id: 'd', header: 'التاريخ', cell: (r) => r.date.slice(0, 10) },
            { id: 'b', header: 'البيان', cell: (r) => r.description || '—' },
            { id: 'a', header: 'مدين', numeric: true, cell: (r) => formatMoney(toFiniteNumber(r.totalDebit)) },
            {
              id: 's',
              header: 'الحالة',
              cell: (r) =>
                r.isPosted ? (
                  <StatusDotPill label="مرحّل" tone="success" />
                ) : (
                  <StatusDotPill label="مسودة" tone="warning" />
                ),
            },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
