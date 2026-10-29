'use client';

import { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AppTable, CompactFormField, FormSectionCard } from '@/components/ui';
import { ReportPageShell } from '@/components/erp';
import { CategorySelect, FA_CRUMB } from '@/components/fixed-assets/shared';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { formatDay, formatMoney, todayIso, type MovementRow } from '@/lib/fixed-assets/types';

type Movement = { from: string; to: string; rows: MovementRow[]; totals: Record<string, number> };

function yearStartIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

export default function FixedAssetMovementReportPage() {
  const [from, setFrom] = useState(yearStartIso());
  const [to, setTo] = useState(todayIso());
  const [categoryId, setCategoryId] = useState('');
  const params = useMemo(() => ({ from, to, ...(categoryId ? { categoryId } : {}) }), [from, to, categoryId]);
  const { data, isLoading } = useApiQuery<Movement>(queryKeys.fixedAssets.movement(params), '/fixed-assets/reports/movement', params, {
    enabled: Boolean(from && to),
    staleTime: 0,
  });
  const report = data?.data;
  const rows: MovementRow[] = report
    ? [
        ...report.rows,
        { ...(report.totals as unknown as MovementRow), categoryId: '__total', code: '', name: 'الإجمالي' },
      ]
    : [];
  const money = (key: keyof MovementRow) =>
    function MoneyCell(r: MovementRow) {
      return r.categoryId === '__total' ? <b>{formatMoney(r[key] as number)}</b> : <>{formatMoney(r[key] as number)}</>;
    };

  return (
    <ReportPageShell
      title="تقرير حركة الأصول الثابتة"
      breadcrumbs={[FA_CRUMB, { label: 'التقارير' }, { label: 'حركة الأصول' }]}
      statusLabel={report ? `${formatDay(report.from)} → ${formatDay(report.to)}` : 'تقرير'}
      favoriteHref="/fixed-assets/reports/movement"
    >
      <FormSectionCard
        title="معايير التقرير"
        subtitle="إيضاح الأصول الثابتة في القوائم المالية (معيار 10) — من الأصول المفعّلة والحركات المرحلة فقط"
        icon={SlidersHorizontal}
        className="mt-2"
      >
        <CompactFormField label="من تاريخ" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <CompactFormField label="إلى تاريخ" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <CompactFormField label="الفئة">
          <CategorySelect value={categoryId} onChange={setCategoryId} emptyLabel="كل الفئات" />
        </CompactFormField>
      </FormSectionCard>

      <AppTable<MovementRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.categoryId}
        emptyTitle="لا توجد أصول في هذه الفترة"
        exportFileName="fixed-assets-movement"
        rowClassName={(r) => (r.categoryId === '__total' ? 'bg-[#F6FBFD]' : undefined)}
        columns={[
          { id: 'name', header: 'الفئة', cell: (r) => (r.code ? `${r.code} - ${r.name}` : <b>{r.name}</b>) },
          { id: 'costOpening', header: 'التكلفة أول الفترة', numeric: true, cell: money('costOpening') },
          { id: 'costAdditions', header: 'إضافات', numeric: true, cell: money('costAdditions') },
          { id: 'costDisposals', header: 'استبعادات', numeric: true, cell: money('costDisposals') },
          { id: 'costClosing', header: 'التكلفة آخر الفترة', numeric: true, cell: money('costClosing') },
          { id: 'accOpening', header: 'المجمع أول الفترة', numeric: true, cell: money('accOpening') },
          { id: 'accOnAdditions', header: 'مجمع الإضافات', numeric: true, cell: money('accOnAdditions') },
          { id: 'accCharge', header: 'إهلاك الفترة', numeric: true, cell: money('accCharge') },
          { id: 'accDisposals', header: 'مجمع المستبعد', numeric: true, cell: money('accDisposals') },
          { id: 'accClosing', header: 'المجمع آخر الفترة', numeric: true, cell: money('accClosing') },
          { id: 'nbvOpening', header: 'صافي القيمة أول الفترة', numeric: true, cell: money('bookValueOpening') },
          { id: 'nbvClosing', header: 'صافي القيمة آخر الفترة', numeric: true, cell: money('bookValueClosing') },
        ]}
      />
    </ReportPageShell>
  );
}
