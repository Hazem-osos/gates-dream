'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { staleTimes } from '@/lib/query/query-keys';
import { formatMoney } from '@/lib/hooks/useExecutiveDashboard';
import { toFiniteNumber } from '@/components/dashboard';
import {
  CommandCenter,
  MetricBar,
  TriageQueue,
  DataGridDense,
  SegmentedBar,
  StatusDotPill,
  DASH_PANEL,
  DASH_GRID,
} from '@/components/dashboard-primitives';

type LcRow = {
  id: string;
  lcNumber?: string;
  status?: string;
  amount?: number | string;
  currencyCode?: string;
  beneficiaryName?: string;
  expiryDate?: string;
};

export default function ImportExportCommand() {
  useBackendReachability();
  const lcQ = useApiQuery<LcRow[]>(
    ['trade-lcs'],
    '/trade/letters-of-credit',
    { limit: 50 },
    { staleTime: staleTimes.transactionalMs, retry: 1 }
  );
  const lgQ = useApiQuery<LcRow[]>(
    ['trade-lgs'],
    '/trade/letters-of-guarantee',
    { limit: 50 },
    { staleTime: staleTimes.transactionalMs, retry: 1 }
  );

  const lcs = lcQ.data?.data ?? [];
  const lgs = lgQ.data?.data ?? [];
  const open = lcs.filter((r) => !/CLOSE|CANCEL|SETTLE/i.test(r.status ?? ''));

  return (
    <CommandCenter
      title="الاستيراد والاعتمادات — التزامات مفتوحة"
      module="TRADE"
      refreshing={lcQ.isFetching}
      onRefresh={() => {
        void lcQ.refetch();
        void lgQ.refetch();
      }}
      shortcuts={[
        { key: 'F2', label: 'اعتماد', href: '/importexport/accreditations/documentary-credit' },
        { key: 'F4', label: 'ضمان', href: '/importexport/accreditations/letters-of-guarantee' },
      ]}
    >
      <MetricBar
        loading={lcQ.isLoading && !lcs.length}
        items={[
          { id: 'lc', label: 'اعتمادات', value: lcs.length, hint: `${open.length} مفتوح` },
          { id: 'lg', label: 'خطابات ضمان', value: lgs.length },
          { id: 'amt', label: 'قيمة الاعتمادات', value: formatMoney(lcs.reduce((s, r) => s + toFiniteNumber(r.amount), 0)) },
          { id: 'exp', label: 'قاربت على الانتهاء', value: lcs.filter((r) => r.expiryDate && Date.parse(r.expiryDate) < Date.now() + 14 * 864e5).length, tone: 'warn' },
          { id: 'err', label: 'مصدر البيانات', value: lcQ.isError ? 'غير متاح' : 'Trade LC', tone: lcQ.isError ? 'warn' : 'ok' },
          { id: 'open', label: 'مفتوحة', value: open.length },
        ]}
      />

      <div className={DASH_GRID}>
        <div className={DASH_PANEL + ' p-2.5'}>
          <p className="mb-2 text-xs font-semibold">مسار الشحنة</p>
          <SegmentedBar
            segments={[
              { label: 'اعتمادات', value: lcs.length, color: '#0E79AA' },
              { label: 'ضمانات', value: lgs.length, color: '#0284C7' },
              { label: 'مفتوحة', value: open.length, color: '#D97706' },
            ]}
          />
        </div>
        <TriageQueue
          title="اعتمادات تحتاج متابعة"
          items={open.slice(0, 10).map((r) => ({
            id: r.id,
            title: r.lcNumber ?? r.id.slice(0, 8),
            meta: r.beneficiaryName ?? r.status,
            amount: formatMoney(toFiniteNumber(r.amount)),
            href: '/importexport/accreditations/documentary-credit',
            tone: 'warn',
          }))}
        />
        <DataGridDense
          title="سجل الاعتمادات"
          loading={lcQ.isLoading}
          rows={lcs.slice(0, 12)}
          columns={[
            { id: 'n', header: 'الرقم', cell: (r) => r.lcNumber ?? r.id.slice(0, 8) },
            {
              id: 's',
              header: 'الحالة',
              cell: (r) => (
                <StatusDotPill
                  label={r.status ?? '—'}
                  tone={/CLOSE|SETTLE/i.test(r.status ?? '') ? 'success' : /CANCEL/i.test(r.status ?? '') ? 'danger' : 'info'}
                />
              ),
            },
            { id: 'a', header: 'القيمة', numeric: true, cell: (r) => formatMoney(toFiniteNumber(r.amount)) },
            { id: 'x', header: 'انتهاء', cell: (r) => r.expiryDate?.slice(0, 10) ?? '—' },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
