'use client';

import { useMemo, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatMoney, useAgingSummary, useExecutiveKpis, useExecutiveOverview } from '@/lib/hooks/useExecutiveDashboard';
import { periodBounds, toFiniteNumber, inPeriod, type DashboardPeriod, PeriodSegmentedControl } from '@/components/dashboard';
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

type InvoiceRow = {
  id: string;
  invoiceNumber?: string | null;
  date?: string;
  netAmount?: number | string | null;
  totalAmount?: number | string | null;
  paidAmount?: number | string | null;
  isPosted?: boolean;
  remainingAmount?: number | string | null;
  customer?: { arabicName?: string };
};

type AgingParty = {
  partyName?: string;
  totalBalance?: number;
  buckets?: { CURRENT?: number; PAST_DUE_31_60?: number; OVERDUE_61_90?: number; DELINQUENT_90_PLUS?: number };
};

export default function SalesCommand() {
  useBackendReachability();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const bounds = periodBounds(period);
  const kpisQ = useExecutiveKpis(6);
  const overviewQ = useExecutiveOverview();
  const arQ = useAgingSummary('CUSTOMER');
  const invoicesQ = useApiQuery<InvoiceRow[]>(
    queryKeys.invoices({ hub: 'sale', ...bounds }),
    '/invoices',
    { invoiceKind: 'SALE', limit: 40, page: 1, startDate: bounds.startDate, endDate: bounds.endDate },
    { staleTime: staleTimes.transactionalMs }
  );

  const invoices = invoicesQ.data?.data ?? [];
  const inRange = invoices.filter((r) => inPeriod(r.date, bounds.startDate, bounds.endDate));
  const todaySales = overviewQ.data?.data?.dailyMilestone?.todaySales ?? 0;
  const monthSales = kpisQ.data?.data?.periodTotals.monthlySales ?? 0;
  const avg30 = monthSales / 30;
  const velocity = avg30 > 0 ? todaySales / avg30 : 0;
  const parties = useMemo(
    () => (arQ.data?.data?.parties ?? []) as AgingParty[],
    [arQ.data?.data?.parties]
  );
  const buckets = useMemo(() => {
    const acc = { c: 0, d30: 0, d60: 0, d90: 0 };
    for (const p of parties) {
      acc.c += p.buckets?.CURRENT ?? 0;
      acc.d30 += p.buckets?.PAST_DUE_31_60 ?? 0;
      acc.d60 += p.buckets?.OVERDUE_61_90 ?? 0;
      acc.d90 += p.buckets?.DELINQUENT_90_PLUS ?? 0;
    }
    return acc;
  }, [parties]);

  return (
    <CommandCenter
      title="المبيعات — سرعة التحصيل والذمم"
      module="SALES"
      refreshing={invoicesQ.isFetching}
      onRefresh={() => {
        void invoicesQ.refetch();
        void kpisQ.refetch();
      }}
      filters={<PeriodSegmentedControl value={period} onChange={setPeriod} />}
      shortcuts={[
        { key: 'F2', label: 'فاتورة', href: '/inventory/operations/sales-invoice' },
        { key: 'F4', label: 'عرض سعر', href: '/inventory/operations/price-quote' },
        { key: 'F5', label: 'أمر بيع', href: '/inventory/operations/sales-order' },
        { key: 'F6', label: 'قبض', href: '/accounting/operations/treasury/receipt-voucher' },
      ]}
    >
      <MetricBar
        loading={kpisQ.isLoading && !monthSales}
        items={[
          { id: 'today', label: 'مبيعات اليوم', value: formatMoney(todaySales), hint: `×${velocity.toFixed(1)} مقابل متوسط 30ي`, tone: velocity < 0.7 ? 'warn' : 'ok', spark: Object.values(kpisQ.data?.data?.monthlyTrend.salesByMonth ?? {}) },
          { id: 'mo', label: 'مبيعات الشهر', value: formatMoney(monthSales) },
          { id: 'ar', label: 'ذمم مدينة', value: formatMoney(arQ.data?.data?.summary.totalOutstanding ?? 0), hint: `${arQ.data?.data?.summary.partyCount ?? 0} عميل` },
          { id: '90', label: '90+', value: formatMoney(buckets.d90), tone: buckets.d90 > 0 ? 'bad' : 'ok' },
          { id: 'unp', label: 'غير مرحلة', value: inRange.filter((r) => !r.isPosted).length, tone: 'warn' },
          { id: 'open', label: 'غير مسددة', value: inRange.filter((r) => toFiniteNumber(r.paidAmount) < toFiniteNumber(r.netAmount ?? r.totalAmount)).length },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">أعمار ديون العملاء</p>
          <SegmentedBar
            segments={[
              { label: '0–30', value: buckets.c, color: '#059669' },
              { label: '31–60', value: buckets.d30, color: '#D97706' },
              { label: '61–90', value: buckets.d60, color: '#EA580C' },
              { label: '90+', value: buckets.d90, color: '#E11D48' },
            ]}
          />
        </div>
        <TriageQueue
          title="متابعة ذمم"
          emptyActionHref="/inventory/operations/sales-invoice"
          emptyActionLabel="فاتورة جديدة"
          items={parties
            .filter((p) => (p.totalBalance ?? 0) > 0)
            .slice(0, 10)
            .map((p, i) => ({
              id: String(i) + (p.partyName ?? ''),
              title: p.partyName ?? 'عميل',
              amount: formatMoney(p.totalBalance ?? 0),
              tone: (p.buckets?.DELINQUENT_90_PLUS ?? 0) > 0 ? 'bad' : 'warn',
              actions: [
                { label: 'كشف', href: '/accounting/account-reports/credit/account-balances' },
              ],
            }))}
        />
        <DataGridDense
          title="فواتير الفترة"
          loading={invoicesQ.isLoading}
          rows={inRange.slice(0, 12)}
          emptyActionHref="/inventory/operations/sales-invoice"
          emptyActionLabel="فاتورة جديدة"
          onRowOpen={() => {
            window.location.href = '/inventory/operations/sales-invoice';
          }}
          columns={[
            { id: 'no', header: 'الفاتورة', cell: (r) => <span className={DASH_NUM}>{r.invoiceNumber ?? r.id.slice(0, 8)}</span> },
            { id: 'c', header: 'العميل', cell: (r) => r.customer?.arabicName ?? '—' },
            { id: 'n', header: 'الصافي', numeric: true, cell: (r) => formatMoney(toFiniteNumber(r.netAmount ?? r.totalAmount)) },
            {
              id: 'p',
              header: 'تحصيل',
              numeric: true,
              cell: (r) => {
                const net = toFiniteNumber(r.netAmount ?? r.totalAmount);
                const paid = toFiniteNumber(r.paidAmount);
                const settled = net > 0 && paid >= net - 0.01;
                if (settled) return <StatusDotPill label="مرحّل ومسدد" tone="success" />;
                return net > 0 ? `${Math.round((paid / net) * 100)}٪` : '—';
              },
            },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
