'use client';

import { useState } from 'react';
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
  taxAmount?: number | string | null;
  isPosted?: boolean;
  supplier?: { arabicName?: string };
};

type OrderRow = {
  id: string;
  orderNumber?: string | null;
  date?: string;
  isPosted?: boolean;
  supplier?: { arabicName?: string };
  netAmount?: number | string | null;
};

export default function PurchasesCommand() {
  useBackendReachability();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const bounds = periodBounds(period);
  const kpisQ = useExecutiveKpis(6);
  const overviewQ = useExecutiveOverview();
  const apQ = useAgingSummary('SUPPLIER');
  const invoicesQ = useApiQuery<InvoiceRow[]>(
    queryKeys.invoices({ hub: 'purchase', ...bounds }),
    '/invoices',
    { invoiceKind: 'PURCHASE', limit: 40, page: 1, startDate: bounds.startDate, endDate: bounds.endDate },
    { staleTime: staleTimes.transactionalMs }
  );
  const ordersQ = useApiQuery<OrderRow[]>(['purchase-orders-hub'], '/inventory/purchase-orders', { limit: 40, page: 1 }, { staleTime: staleTimes.transactionalMs });

  const inRange = (invoicesQ.data?.data ?? []).filter((r) => inPeriod(r.date, bounds.startDate, bounds.endDate));
  const orders = ordersQ.data?.data ?? [];
  const openPo = orders.filter((o) => !o.isPosted);

  return (
    <CommandCenter
      title="المشتريات — أوامر التوريد والاستحقاق"
      module="PURCHASES"
      refreshing={invoicesQ.isFetching}
      onRefresh={() => {
        void invoicesQ.refetch();
        void ordersQ.refetch();
      }}
      filters={<PeriodSegmentedControl value={period} onChange={setPeriod} />}
      shortcuts={[
        { key: 'F2', label: 'فاتورة شراء', href: '/inventory/operations/final-purchase-invoice' },
        { key: 'F4', label: 'أمر توريد', href: '/inventory/operations/purchase-order' },
        { key: 'F6', label: 'سداد', href: '/accounting/operations/treasury/cash-payment' },
      ]}
    >
      <MetricBar
        loading={kpisQ.isLoading}
        items={[
          { id: 'p', label: 'مشتريات الفترة', value: formatMoney(kpisQ.data?.data?.periodTotals.monthlyPurchases ?? 0), spark: Object.values(kpisQ.data?.data?.monthlyTrend.purchaseByMonth ?? {}) },
          { id: 'ap', label: 'مستحق للموردين', value: formatMoney(apQ.data?.data?.summary.totalOutstanding ?? 0), hint: `${apQ.data?.data?.summary.partyCount ?? 0} مورد` },
          { id: 'due', label: 'استحقاق 14ي', value: formatMoney(overviewQ.data?.data?.shortTermCommitments.supplierApDue14Days ?? 0), tone: 'warn' },
          { id: 'vat', label: 'ضريبة مدخلات', value: formatMoney(inRange.reduce((s, r) => s + toFiniteNumber(r.taxAmount), 0)) },
          { id: 'po', label: 'أوامر بانتظار الاستلام', value: openPo.length, tone: openPo.length ? 'warn' : 'ok' },
          { id: 'gl', label: 'غير مرحلة GL', value: inRange.filter((r) => !r.isPosted).length, tone: 'bad' },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">دورة الشراء</p>
          <SegmentedBar
            segments={[
              { label: 'أوامر', value: orders.length, color: '#0E79AA' },
              { label: 'فواتير', value: inRange.length, color: '#D97706' },
              { label: 'مرحلة', value: inRange.filter((r) => r.isPosted).length, color: '#059669' },
            ]}
          />
        </div>
        <TriageQueue
          title="أوامر شراء معلّقة"
          emptyActionHref="/inventory/operations/purchase-order"
          emptyActionLabel="أمر توريد جديد"
          items={openPo.slice(0, 12).map((o) => ({
            id: o.id,
            title: o.orderNumber ?? o.id.slice(0, 8),
            meta: o.supplier?.arabicName,
            amount: formatMoney(toFiniteNumber(o.netAmount)),
            href: '/inventory/operations/purchase-order',
            tone: 'warn',
            actions: [{ label: 'استلام', href: '/inventory/operations/receipt' }],
          }))}
        />
        <DataGridDense
          title="فواتير الموردين"
          loading={invoicesQ.isLoading}
          rows={inRange.slice(0, 12)}
          columns={[
            { id: 'no', header: 'الفاتورة', cell: (r) => <span className={DASH_NUM}>{r.invoiceNumber ?? r.id.slice(0, 8)}</span> },
            { id: 's', header: 'المورد', cell: (r) => r.supplier?.arabicName ?? '—' },
            { id: 'n', header: 'الصافي', numeric: true, cell: (r) => formatMoney(toFiniteNumber(r.netAmount ?? r.totalAmount)) },
            {
              id: 'st',
              header: 'GL',
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
