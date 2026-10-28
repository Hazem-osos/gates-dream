'use client';

import { useMemo, useState } from 'react';
import { AppTable, CompactFormField, FormSectionCard } from '@/app/components/ui';
import { CategorySelect, FixedAssetsPage } from '@/components/fixed-assets/shared';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { formatDay, formatMoney, todayIso, type MovementRow } from '@/lib/fixed-assets/types';

type Movement = { from: string; to: string; rows: MovementRow[]; totals: Record<keyof MovementRow, number> };

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
  const rows = report ? [...report.rows, { ...(report.totals as unknown as MovementRow), categoryId: '__total', code: '', name: 'الإجمالي' }] : [];
  const money = (key: keyof MovementRow) => (r: MovementRow) => formatMoney(r[key] as number);

  return (
    <FixedAssetsPage
      title="تقرير حركة الأصول"
      description="جدول الحركة لكل فئة (إيضاح الأصول الثابتة في القوائم المالية — معيار 10): التكلفة ومجمع الإهلاك أول وآخر الفترة."
    >
      <FormSectionCard>
        <CompactFormField label="من" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <CompactFormField label="إلى" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <CompactFormField label="الفئة">
          <CategorySelect value={categoryId} onChange={setCategoryId} emptyLabel="كل الفئات" />
        </CompactFormField>
      </FormSectionCard>

      {report ? (
        <p className="text-xs text-foreground-muted">
          الفترة من {formatDay(report.from)} إلى {formatDay(report.to)} — من الأصول المفعّلة والإهلاك والاستبعادات المرحلة فقط.
        </p>
      ) : null}

      <AppTable<MovementRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.categoryId}
        emptyTitle="لا توجد أصول في هذه الفترة"
        exportFileName="fixed-assets-movement"
        columns={[
          { id: 'name', header: 'الفئة', cell: (r) => (r.code ? `${r.code} - ${r.name}` : <b>{r.name}</b>) },
          { id: 'costOpening', header: 'التكلفة أول الفترة', numeric: true, cell: money('costOpening') },
          { id: 'costAdditions', header: 'إضافات', numeric: true, cell: money('costAdditions') },
          { id: 'costDisposals', header: 'استبعادات', numeric: true, cell: money('costDisposals') },
          { id: 'costClosing', header: 'التكلفة آخر الفترة', numeric: true, cell: money('costClosing') },
          { id: 'accOpening', header: 'مجمع الإهلاك أول الفترة', numeric: true, cell: money('accOpening') },
          { id: 'accOnAdditions', header: 'مجمع إهلاك الإضافات', numeric: true, cell: money('accOnAdditions') },
          { id: 'accCharge', header: 'إهلاك الفترة', numeric: true, cell: money('accCharge') },
          { id: 'accDisposals', header: 'مجمع إهلاك المستبعد', numeric: true, cell: money('accDisposals') },
          { id: 'accClosing', header: 'مجمع الإهلاك آخر الفترة', numeric: true, cell: money('accClosing') },
          { id: 'nbvOpening', header: 'صافي القيمة أول الفترة', numeric: true, cell: money('bookValueOpening') },
          { id: 'nbvClosing', header: 'صافي القيمة آخر الفترة', numeric: true, cell: money('bookValueClosing') },
        ]}
      />
    </FixedAssetsPage>
  );
}
