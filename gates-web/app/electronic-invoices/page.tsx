'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/real-estate/format';
import type { ElectronicInvoiceDashboardSummary } from '@/lib/dashboards/types';
import { SensitiveValue } from '@/app/components/ui/SensitiveValue';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  DASH_PANEL,
  DASH_GRID,
} from '@/components/dashboard-primitives';

const ETA: Record<string, string> = {
  NOT_SUBMITTED: 'غير مرسلة',
  PROCESSING: 'معالجة',
  VALID: 'مقبولة',
  INVALID: 'مرفوضة',
};

export default function ElectronicInvoicesCommand() {
  const { data, isLoading, isFetching, refetch } = useApiQuery<ElectronicInvoiceDashboardSummary>(
    queryKeys.electronicInvoices.dashboard(),
    '/electronic-invoices/dashboard/summary',
    undefined,
    { staleTime: staleTimes.transactionalMs, requireFullTenant: false }
  );
  const s = data?.data;
  const k = s?.kpis;
  const spark = (s?.charts.monthlySubmissions ?? []).map((m) => m.submitted);

  return (
    <CommandCenter
      title="الفواتير الإلكترونية — طابور ETA"
      module="ETA / e-INVOICE"
      asOf={s?.asOfDate}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'إرسال', href: '/electronic-invoices/creations/send-invoice' },
        { key: 'F4', label: 'مرتجع', href: '/electronic-invoices/creations/send-returns' },
        { key: 'F6', label: 'إعدادات', href: '/electronic-invoices/settings' },
      ]}
    >
      {!s?.settings.ready && !isLoading ? (
        <p className="mb-2 border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          إعدادات ETA ناقصة — الرقم الضريبي وبيانات الربط مطلوبة قبل الإرسال.
        </p>
      ) : null}

      <MetricBar
        loading={isLoading && !s}
        items={[
          { id: 'ns', label: 'غير مرسلة', value: k?.notSubmitted ?? 0, hint: `${k?.postedSales ?? 0} بيع مرحّل`, tone: (k?.notSubmitted ?? 0) > 0 ? 'warn' : 'ok', spark },
          { id: 'ok', label: 'مقبولة', value: k?.valid ?? 0, hint: <SensitiveValue>{formatEgp(k?.validValue)}</SensitiveValue>, tone: 'ok' },
          { id: 'bad', label: 'مرفوضة', value: k?.invalid ?? 0, hint: <SensitiveValue>{formatEgp(k?.invalidValue)}</SensitiveValue>, tone: (k?.invalid ?? 0) > 0 ? 'bad' : 'ok' },
          { id: 'proc', label: 'قيد المعالجة', value: k?.processing ?? 0 },
          { id: 'cust', label: 'بطاقات عملاء', value: k?.customerCards ?? 0, hint: `${k?.itemCards ?? 0} صنف` },
          { id: 'ret', label: 'مرتجعات', value: k?.returnsInvoices ?? 0, hint: `${k?.amendments ?? 0} تعديل` },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">دورة الإرسال</p>
          <SegmentedBar
            segments={[
              { label: 'غير مرسلة', value: k?.notSubmitted ?? 0, color: '#D97706' },
              { label: 'معالجة', value: k?.processing ?? 0, color: '#0E79AA' },
              { label: 'مقبولة', value: k?.valid ?? 0, color: '#059669' },
              { label: 'مرفوضة', value: k?.invalid ?? 0, color: '#E11D48' },
            ]}
          />
        </div>
        <TriageQueue
          title="استثناءات ETA"
          loading={isLoading}
          items={(s?.inbox ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.detail,
            amount: item.amount != null ? <SensitiveValue>{formatEgp(item.amount)}</SensitiveValue> : undefined,
            href: item.href,
            tone: item.tone === 'red' ? 'bad' : 'warn',
            actions: [{ label: 'إرسال', href: item.href }],
          }))}
        />
        <DataGridDense
          title="آخر المستندات"
          loading={isLoading}
          rows={(s?.activity ?? []).map((a) => ({ ...a }))}
          columns={[
            { id: 't', header: 'المستند', cell: (r) => r.title },
            { id: 'd', header: 'التفاصيل', cell: (r) => r.detail },
            { id: 's', header: 'الحالة', cell: (r) => ETA[r.status] ?? r.status },
            { id: 'at', header: 'التاريخ', cell: (r) => r.at.slice(0, 10) },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
