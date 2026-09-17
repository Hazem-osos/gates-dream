'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UnifiedReportFilterCard } from '@/components/report/UnifiedReportFilterCard';
import {
  ReportFilterDate,
  ReportFilterDelegateSelect,
  ReportFilterPageShell,
  ReportFilterWarehouseSelect,
} from '@/components/report/reportFilterFields';
import { breadcrumbsForReportModule } from '@/lib/reports/reportPageBreadcrumbs';
import { localTodayIso } from '@/lib/reportPreview/resolveReportEndpoint';

function emptyPosDailyFilters() {
  return {
    date: localTodayIso(),
    warehouseId: '',
    sellerId: '',
  };
}

export default function DailyPOSPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyPosDailyFilters);
  const breadcrumbs = useMemo(
    () => breadcrumbsForReportModule('pos', 'يومية نقاط البيع'),
    []
  );

  const patch = (p: Partial<ReturnType<typeof emptyPosDailyFilters>>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  const handlePreview = () => {
    if (!filters.date) {
      setError('يرجى تحديد التاريخ');
      return;
    }
    setError('');
    const qs = new URLSearchParams();
    qs.set('date', filters.date);
    if (filters.warehouseId) qs.set('warehouseId', filters.warehouseId);
    if (filters.sellerId) qs.set('sellerId', filters.sellerId);
    router.push(`/pos/daily/preview?${qs.toString()}`);
  };

  return (
    <ReportFilterPageShell
      title="يومية نقاط البيع"
      description="مراجعة مبيعات الوردية حسب التاريخ والمخزن والبائع."
      breadcrumbs={breadcrumbs}
      error={error}
      onClearError={() => setError('')}
    >
      <UnifiedReportFilterCard
        icon="📊"
        title="يومية نقاط البيع"
        showTitle={false}
        onPreview={handlePreview}
        onReset={() => {
          setFilters(emptyPosDailyFilters());
          setError('');
        }}
      >
        <ReportFilterDate
          label="التاريخ"
          value={filters.date}
          onChange={(date) => patch({ date })}
        />
        <ReportFilterWarehouseSelect
          label="المخزن"
          value={filters.warehouseId}
          onChange={(warehouseId) => patch({ warehouseId })}
        />
        <ReportFilterDelegateSelect
          label="البائع"
          value={filters.sellerId}
          onChange={(sellerId) => patch({ sellerId })}
          emptyLabel="كل البائعين"
        />
      </UnifiedReportFilterCard>
    </ReportFilterPageShell>
  );
}
