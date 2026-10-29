'use client';

import { useRouter } from 'next/navigation';
import { CommandCenter, DataGridDense, MetricBar, StatusDotPill, TriageQueue, DASH_GRID } from '@/components/dashboard-primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { STATUS_LABELS, formatDay, formatMoney, type FixedAsset } from '@/lib/fixed-assets/types';

type Summary = {
  byStatus: Record<string, { count: number; cost: number; accumulated: number; bookValue: number }>;
  inService: { count: number; cost: number; accumulated: number; bookValue: number };
  lastRun: { runNumber: string; periodEnd: string; totalAmount: number } | null;
};

const STATUS_TONE = { DRAFT: 'neutral', ACTIVE: 'success', FULLY_DEPRECIATED: 'warning', DISPOSED: 'danger' } as const;

export default function FixedAssetsCommand() {
  const router = useRouter();
  const summaryQ = useApiQuery<Summary>(queryKeys.fixedAssets.summary(), '/fixed-assets/assets/summary', undefined, {
    staleTime: 0,
  });
  const recentParams = { page: 1, limit: 12 };
  const recentQ = useApiQuery<FixedAsset[]>(queryKeys.fixedAssets.assets({ home: true, ...recentParams }), '/fixed-assets/assets', recentParams, {
    staleTime: 0,
  });
  const draftParams = { page: 1, limit: 10, status: 'DRAFT' };
  const draftsQ = useApiQuery<FixedAsset[]>(queryKeys.fixedAssets.assets({ home: true, ...draftParams }), '/fixed-assets/assets', draftParams, {
    staleTime: 0,
  });

  const s = summaryQ.data?.data;
  const drafts = draftsQ.data?.data ?? [];
  const recent = recentQ.data?.data ?? [];
  const fully = s?.byStatus?.FULLY_DEPRECIATED?.count ?? 0;

  return (
    <CommandCenter
      title="الأصول الثابتة — السجل والإهلاك"
      module="FIXED ASSETS"
      refreshing={summaryQ.isFetching}
      onRefresh={() => {
        void summaryQ.refetch();
        void recentQ.refetch();
        void draftsQ.refetch();
      }}
      shortcuts={[
        { key: 'F2', label: 'أصل جديد', href: '/fixed-assets/assets/new' },
        { key: 'F4', label: 'الإهلاك الشهري', href: '/fixed-assets/depreciation' },
        { key: 'F6', label: 'بيع / استبعاد', href: '/fixed-assets/disposals' },
      ]}
    >
      <MetricBar
        loading={summaryQ.isLoading && !s}
        items={[
          { id: 'count', label: 'أصول في الخدمة', value: s?.inService.count ?? 0, hint: `${fully} مُهلك بالكامل` },
          { id: 'cost', label: 'إجمالي التكلفة', value: formatMoney(s?.inService.cost) },
          { id: 'acc', label: 'مجمع الإهلاك', value: formatMoney(s?.inService.accumulated) },
          { id: 'nbv', label: 'صافي القيمة الدفترية', value: formatMoney(s?.inService.bookValue), tone: 'ok' },
          {
            id: 'run',
            label: 'آخر إهلاك مرحل',
            value: s?.lastRun ? formatDay(s.lastRun.periodEnd) : 'لا يوجد',
            hint: s?.lastRun ? `رقم ${s.lastRun.runNumber}` : undefined,
            tone: s?.lastRun ? 'neutral' : 'warn',
          },
          { id: 'draft', label: 'بانتظار التفعيل', value: s?.byStatus?.DRAFT?.count ?? 0, tone: drafts.length ? 'warn' : 'ok' },
        ]}
      />

      <div className={DASH_GRID}>
        <TriageQueue
          title="أصول بانتظار التفعيل"
          loading={draftsQ.isLoading}
          empty="كل الأصول مُفعّلة"
          emptyActionHref="/fixed-assets/assets/new"
          emptyActionLabel="إضافة أصل"
          items={drafts.map((a) => ({
            id: a.id,
            title: `${a.code} — ${a.arabicName}`,
            meta: a.category?.arabicName,
            amount: formatMoney(a.cost),
            href: `/fixed-assets/assets/${a.id}`,
            tone: 'warn' as const,
          }))}
        />
        <DataGridDense<FixedAsset>
          title="أحدث الأصول"
          loading={recentQ.isLoading}
          rows={recent}
          empty="لا توجد أصول بعد"
          emptyActionHref="/fixed-assets/categories"
          emptyActionLabel="ابدأ بتعريف فئات الأصول"
          onRowOpen={(r) => router.push(`/fixed-assets/assets/${r.id}`)}
          columns={[
            { id: 'code', header: 'الكود', cell: (r) => r.code },
            { id: 'name', header: 'الأصل', cell: (r) => r.arabicName },
            {
              id: 'status',
              header: 'الحالة',
              cell: (r) => <StatusDotPill label={STATUS_LABELS[r.status]} tone={STATUS_TONE[r.status]} />,
            },
            { id: 'cost', header: 'التكلفة', numeric: true, cell: (r) => formatMoney(r.cost) },
            { id: 'nbv', header: 'صافي القيمة', numeric: true, cell: (r) => formatMoney(r.bookValue) },
          ]}
        />
      </div>
    </CommandCenter>
  );
}
