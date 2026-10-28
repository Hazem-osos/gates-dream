'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppTable, Button, CompactFormField, FormSectionCard, StatusBadge } from '@/app/components/ui';
import { FixedAssetsPage, JournalPreviewTable } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import {
  formatDay,
  formatMoney,
  journalHref,
  lastMonthEndIso,
  type DepreciationRun,
  type RunPreview,
} from '@/lib/fixed-assets/types';

export default function DepreciationRunsPage() {
  const invalidate = useInvalidateQuery();
  const [periodEnd, setPeriodEnd] = useState(lastMonthEndIso());
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<RunPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const { data, isLoading } = useApiQuery<DepreciationRun[]>(queryKeys.fixedAssets.runs(), '/fixed-assets/depreciation-runs', undefined, {
    staleTime: 0,
  });
  const runs = data?.data ?? [];
  const { data: runDetail } = useApiQuery<DepreciationRun>(
    queryKeys.fixedAssets.run(openRunId ?? ''),
    `/fixed-assets/depreciation-runs/${openRunId}`,
    undefined,
    { enabled: Boolean(openRunId), staleTime: 0 }
  );

  const refresh = () => invalidate(queryKeys.fixedAssets.all);

  const runPreview = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post<RunPreview>(
        '/fixed-assets/depreciation-runs/preview',
        { periodEnd },
        { skipSuccessNotify: true }
      );
      setPreview(res.data ?? null);
    } catch {
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const post = async () => {
    if (!window.confirm(`ترحيل إهلاك الأصول حتى ${formatDay(preview?.periodEnd)} بمبلغ ${formatMoney(preview?.totalAmount)}؟`)) return;
    setBusy(true);
    try {
      await apiClient.post('/fixed-assets/depreciation-runs', { periodEnd, notes: notes.trim() || null });
      setPreview(null);
      setNotes('');
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const action = async (run: DepreciationRun, kind: 'unpost' | 'repost' | 'delete') => {
    const text = {
      unpost: `إلغاء ترحيل تشغيل الإهلاك رقم ${run.runNumber}؟ يُلغى ترحيل القيد في مكانه ويعود الأصل لحالته السابقة.`,
      repost: `إعادة ترحيل التشغيل رقم ${run.runNumber}؟ يُعاد الحساب على بيانات الأصول الحالية بنفس رقم القيد.`,
      delete: `حذف التشغيل رقم ${run.runNumber}؟ سيُلغى قيده.`,
    }[kind];
    if (!window.confirm(text)) return;
    setBusy(true);
    try {
      if (kind === 'delete') await apiClient.delete(`/fixed-assets/depreciation-runs/${run.id}`);
      else await apiClient.post(`/fixed-assets/depreciation-runs/${run.id}/${kind}`);
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  return (
    <FixedAssetsPage
      title="الإهلاك الشهري"
      description="يُحسب إهلاك كل الأصول في الخدمة حتى نهاية الشهر المختار — بما فيها أي أشهر سابقة لم تُهلك — ويُرحَّل في قيد واحد: من مصروف الإهلاك إلى مجمع الإهلاك."
    >
      <FormSectionCard
        title="تشغيل إهلاك جديد"
        subtitle="الإهلاك يُرحل بالتتابع: كل تشغيل لشهر بعد آخر شهر مرحل. للتعديل ألغِ ترحيل آخر تشغيل ثم أعد ترحيله."
        headerActions={
          <>
            <Button variant="secondary" disabled={busy} onClick={runPreview}>
              احسب ومعاينة
            </Button>
            <Button disabled={busy || !preview || preview.totalAmount <= 0} onClick={post}>
              ترحيل
            </Button>
          </>
        }
      >
        <CompactFormField
          label="حتى نهاية شهر"
          required
          type="date"
          value={periodEnd}
          onChange={(e) => {
            setPeriodEnd(e.target.value);
            setPreview(null);
          }}
        />
        <CompactFormField label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {preview ? (
          <div className="space-y-3 md:col-span-full">
            <p className="text-sm">
              الإجمالي حتى {formatDay(preview.periodEnd)}: <b>{formatMoney(preview.totalAmount)}</b> على {preview.assets.length} أصل
            </p>
            <AppTable
              data={preview.assets}
              getRowKey={(r) => r.assetId}
              emptyTitle="لا يوجد إهلاك مستحق"
              exportFileName="depreciation-preview"
              columns={[
                { id: 'code', header: 'الكود', accessor: 'code' },
                { id: 'name', header: 'الأصل', accessor: 'name' },
                { id: 'months', header: 'عدد الأشهر', numeric: true, cell: (r) => String(r.months) },
                { id: 'amount', header: 'الإهلاك', numeric: true, cell: (r) => formatMoney(r.amount) },
                { id: 'acc', header: 'المجمع بعده', numeric: true, cell: (r) => formatMoney(r.accumulatedAfter) },
              ]}
            />
            <JournalPreviewTable lines={preview.journal} />
          </div>
        ) : null}
      </FormSectionCard>

      <AppTable<DepreciationRun>
        isLoading={isLoading}
        data={runs}
        getRowKey={(r) => r.id}
        emptyTitle="لم يُرحل إهلاك بعد"
        onRowClick={(r) => setOpenRunId(openRunId === r.id ? null : r.id)}
        columns={[
          { id: 'number', header: 'رقم التشغيل', accessor: 'runNumber' },
          { id: 'period', header: 'حتى', cell: (r) => formatDay(r.periodEnd) },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center',
            cell: (r) => (
              <StatusBadge compact variant={r.status === 'POSTED' ? 'success' : 'warning'} label={r.status === 'POSTED' ? 'مرحل' : 'غير مرحل'} />
            ),
          },
          { id: 'total', header: 'الإجمالي', numeric: true, cell: (r) => formatMoney(r.totalAmount) },
          { id: 'lines', header: 'سطور', numeric: true, cell: (r) => String(r._count?.lines ?? 0) },
          {
            id: 'journal',
            header: 'القيد',
            cell: (r) =>
              r.journalEntryId ? (
                <Link className="text-brand underline" href={journalHref(r.journalEntryId)} onClick={(e) => e.stopPropagation()}>
                  فتح القيد
                </Link>
              ) : (
                '—'
              ),
          },
          {
            id: 'actions',
            header: '',
            cell: (r) => (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {r.status === 'POSTED' ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => action(r, 'unpost')}>
                    إلغاء الترحيل
                  </Button>
                ) : (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => action(r, 'repost')}>
                      إعادة الترحيل
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => action(r, 'delete')}>
                      حذف
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />

      {openRunId && runDetail?.data?.lines ? (
        <FormSectionCard title={`تفاصيل التشغيل ${runDetail.data.runNumber}`} bodyClassName="block">
          <AppTable
            data={runDetail.data.lines}
            getRowKey={(l) => l.id}
            exportFileName={`depreciation-run-${runDetail.data.runNumber}`}
            columns={[
              { id: 'code', header: 'الكود', cell: (l) => l.asset.code },
              { id: 'name', header: 'الأصل', cell: (l) => l.asset.arabicName },
              { id: 'month', header: 'الشهر', cell: (l) => formatDay(l.periodMonth) },
              { id: 'amount', header: 'الإهلاك', numeric: true, cell: (l) => formatMoney(l.amount) },
              { id: 'acc', header: 'المجمع بعده', numeric: true, cell: (l) => formatMoney(l.accumulatedAfter) },
            ]}
          />
        </FormSectionCard>
      ) : null}
    </FixedAssetsPage>
  );
}
