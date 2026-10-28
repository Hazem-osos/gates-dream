'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppTable, Button, StatusBadge } from '@/app/components/ui';
import { DisposalForm } from '@/components/fixed-assets/DisposalForm';
import { FixedAssetsPage } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { formatDay, formatMoney, journalHref, toNumber, type FixedAssetDisposal } from '@/lib/fixed-assets/types';

export default function FixedAssetDisposalsPage() {
  const invalidate = useInvalidateQuery();
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useApiQuery<FixedAssetDisposal[]>(queryKeys.fixedAssets.disposals(), '/fixed-assets/disposals', undefined, {
    staleTime: 0,
  });
  const rows = data?.data ?? [];
  const refresh = () => invalidate(queryKeys.fixedAssets.all);

  const action = async (row: FixedAssetDisposal, kind: 'unpost' | 'delete') => {
    const text =
      kind === 'unpost'
        ? `إلغاء ترحيل الاستبعاد رقم ${row.disposalNumber}؟ يعود الأصل للخدمة ويُلغى ترحيل القيد في مكانه.`
        : `حذف مستند الاستبعاد رقم ${row.disposalNumber}؟ سيُلغى قيده.`;
    if (!window.confirm(text)) return;
    setBusy(true);
    try {
      if (kind === 'delete') await apiClient.delete(`/fixed-assets/disposals/${row.id}`);
      else await apiClient.post(`/fixed-assets/disposals/${row.id}/unpost`);
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  return (
    <FixedAssetsPage title="بيع واستبعاد الأصول">
      <DisposalForm onPosted={refresh} />
      <AppTable<FixedAssetDisposal>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد عمليات بيع أو استبعاد"
        exportFileName="fixed-asset-disposals"
        columns={[
          { id: 'number', header: 'الرقم', accessor: 'disposalNumber' },
          { id: 'date', header: 'التاريخ', cell: (r) => formatDay(r.disposalDate) },
          {
            id: 'asset',
            header: 'الأصل',
            cell: (r) =>
              r.asset ? (
                <Link className="text-brand underline" href={`/fixed-assets/assets/${r.asset.id}`}>
                  {r.asset.code} - {r.asset.arabicName}
                </Link>
              ) : (
                '—'
              ),
          },
          { id: 'type', header: 'النوع', cell: (r) => (r.disposalType === 'SALE' ? 'بيع' : 'استبعاد') },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center',
            cell: (r) => (
              <StatusBadge compact variant={r.status === 'POSTED' ? 'success' : 'warning'} label={r.status === 'POSTED' ? 'مرحل' : 'غير مرحل'} />
            ),
          },
          { id: 'proceeds', header: 'المتحصلات', numeric: true, cell: (r) => formatMoney(r.proceeds) },
          { id: 'nbv', header: 'صافي القيمة', numeric: true, cell: (r) => formatMoney(r.bookValue) },
          {
            id: 'gl',
            header: 'ربح / (خسارة)',
            numeric: true,
            cell: (r) => {
              const v = toNumber(r.gainLoss);
              return <span className={v >= 0 ? 'text-emerald-700' : 'text-red-700'}>{v >= 0 ? formatMoney(v) : `(${formatMoney(-v)})`}</span>;
            },
          },
          {
            id: 'journal',
            header: 'القيد',
            cell: (r) =>
              r.journalEntryId ? (
                <Link className="text-brand underline" href={journalHref(r.journalEntryId)}>
                  فتح القيد
                </Link>
              ) : (
                '—'
              ),
          },
          {
            id: 'actions',
            header: '',
            cell: (r) =>
              r.status === 'POSTED' ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => action(r, 'unpost')}>
                  إلغاء الترحيل
                </Button>
              ) : (
                <Button size="sm" variant="danger" disabled={busy} onClick={() => action(r, 'delete')}>
                  حذف
                </Button>
              ),
          },
        ]}
      />
    </FixedAssetsPage>
  );
}
